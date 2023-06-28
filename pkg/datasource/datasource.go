package datasource

import (
	"context"
	"errors"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/httpclient"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/metrics"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

var (
	ErrFunctionsNotSupported      = errors.New("zabbix queries with functions are not supported")
	ErrNonMetricQueryNotSupported = errors.New("non-metrics queries are not supported")
)

type ZabbixDatasource struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

// ZabbixDatasourceInstance stores state about a specific datasource
// and provides methods to make requests to the Zabbix API
type ZabbixDatasourceInstance struct {
	zabbix   *zabbix.Zabbix
	dsInfo   *backend.DataSourceInstanceSettings
	Settings *settings.ZabbixDatasourceSettings
	logger   log.Logger
}

func NewZabbixDatasource() *ZabbixDatasource {
	im := datasource.NewInstanceManager(newZabbixDatasourceInstance)
	return &ZabbixDatasource{
		im:     im,
		logger: log.New(),
	}
}

// newZabbixDatasourceInstance returns an initialized zabbix datasource instance
func newZabbixDatasourceInstance(dsSettings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	logger := log.New()
	logger.Debug("Initializing new data source instance")

	zabbixSettings, err := settings.ReadZabbixSettings(&dsSettings)
	if err != nil {
		logger.Error("Error parsing Zabbix settings", "error", err)
		return nil, err
	}

	client, err := httpclient.New(&dsSettings, zabbixSettings.Timeout)
	if err != nil {
		logger.Error("Error initializing HTTP client", "error", err)
		return nil, err
	}

	zabbixAPI, err := zabbixapi.New(dsSettings.URL, client)
	if err != nil {
		logger.Error("Error initializing Zabbix API", "error", err)
		return nil, err
	}

	zabbixClient, err := zabbix.New(&dsSettings, zabbixSettings, zabbixAPI)
	if err != nil {
		logger.Error("Error initializing Zabbix client", "error", err)
		return nil, err
	}

	return &ZabbixDatasourceInstance{
		dsInfo:   &dsSettings,
		zabbix:   zabbixClient,
		Settings: zabbixSettings,
		logger:   logger,
	}, nil
}

// CheckHealth checks if the plugin is running properly
func (ds *ZabbixDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}

	dsInstance, err := ds.getDSInstance(ctx, req.PluginContext)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Error getting datasource instance"
		ds.logger.Error("Error getting datasource instance", "err", err)
		return res, nil
	}

	message, err := dsInstance.TestConnection(ctx)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = err.Error()
		ds.logger.Error("Error connecting Zabbix server", "err", err)
		return res, nil
	}

	res.Status = backend.HealthStatusOk
	res.Message = message
	return res, nil
}

func (ds *ZabbixDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	metrics.DataSourceQueryTotal.WithLabelValues("metrics").Inc()
	qdr := backend.NewQueryDataResponse()

	zabbixDS, err := ds.getDSInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	for _, q := range req.Queries {
		res := backend.DataResponse{}
		query, err := ReadQuery(q)
		ds.logger.Debug("DS query", "query", q)
		if err != nil {
			res.Error = err
		} else if query.QueryType == MODE_METRICS {
			frames, err := zabbixDS.queryNumericItems(ctx, &query)
			if err != nil {
				res.Error = err
			} else {
				res.Frames = append(res.Frames, frames...)
			}
		} else if query.QueryType == MODE_ITEMID {
			frames, err := zabbixDS.queryItemIdData(ctx, &query)
			if err != nil {
				res.Error = err
			} else {
				res.Frames = append(res.Frames, frames...)
			}
		} else {
			res.Error = ErrNonMetricQueryNotSupported
		}
		qdr.Responses[q.RefID] = res
	}

	return qdr, nil
}

// getDSInstance Returns cached datasource or creates new one
func (ds *ZabbixDatasource) getDSInstance(ctx context.Context, pluginContext backend.PluginContext) (*ZabbixDatasourceInstance, error) {
	instance, err := ds.im.Get(ctx, pluginContext)
	if err != nil {
		return nil, err
	}
	return instance.(*ZabbixDatasourceInstance), nil
}
