package datasource

import (
	"context"
	"errors"
	"strings"

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
func newZabbixDatasourceInstance(ctx context.Context, dsSettings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	logger := log.New()
	logger.Debug("Initializing new data source instance")

	zabbixSettings, err := settings.ReadZabbixSettings(&dsSettings)
	if err != nil {
		logger.Error("Error parsing Zabbix settings", "error", err)
		return nil, err
	}

	client, err := httpclient.New(ctx, &dsSettings, zabbixSettings.Timeout)
	if err != nil {
		logger.Error("Error initializing HTTP client", "error", err)
		return nil, err
	}

	zabbixAPI, err := zabbixapi.New(dsSettings, client)
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

	// --- Per-user authentication logic START ---
	if zabbixDS.Settings.PerUserAuth {
		user := backend.UserFromContext(ctx)
		if user == nil {
			return nil, errors.New("no Grafana user found in request context")
		}

		var identity string
		switch zabbixDS.Settings.PerUserAuthField {
		case "email":
			identity = user.Email
		default:
			identity = user.Login
		}

		// Check if the user is excluded from per-user auth
		excluded := false
		exclusionList := zabbixDS.Settings.PerUserAuthExcludeUsers
		if exclusionList == nil {
			exclusionList = []string{"admin"} // Default exclusion
		}
		for _, excludedUser := range exclusionList {
			if strings.EqualFold(identity, excludedUser) {
				excluded = true
				break
			}
		}

		if excluded {
			ds.logger.Debug("User is excluded from per-user authentication", "identity", identity)
		} else {
			zabbixVersion, err := zabbixDS.zabbix.GetVersion(ctx)
			if err != nil {
				return nil, errors.New("error getting Zabbix version: " + err.Error())
			}

			// Query Zabbix for the user
			zabbixUser, err := zabbixDS.zabbix.GetAPI().GetUserByIdentity(ctx, zabbixDS.Settings.PerUserAuthField, identity, zabbixVersion)
			if err != nil {
				return nil, errors.New("error querying Zabbix for user: " + err.Error())
			}
			if zabbixUser == nil || len(zabbixUser.MustArray()) == 0 {
				return nil, errors.New("user " + identity + " not found in Zabbix. Contact your administrator to provision access")
			}
			userId := zabbixUser.GetIndex(0).Get("userid").MustString()
			userName := zabbixUser.GetIndex(0).Get("username").MustString()

			// Generate or retrieve Zabbix API token
			token, err := zabbixDS.zabbix.GetAPI().GenerateUserAPIToken(ctx, userId, userName, zabbixVersion)
			if err != nil {
				return nil, errors.New("failed to generate Zabbix API token for user: " + err.Error())
			}

			zabbixDS.zabbix.GetAPI().SetAuth(token)

			ds.logger.Debug("Per-user authentication enabled", "identity", identity)
		}
	}

	// --- Per-user authentication logic END ---

	for _, q := range req.Queries {
		res := backend.DataResponse{}
		query, err := ReadQuery(q)
		ds.logger.Debug("DS query", "query", q)
		if err != nil {
			res = backend.ErrorResponseWithErrorSource(err)
		} else if query.QueryType == MODE_METRICS {
			frames, err := zabbixDS.queryNumericItems(ctx, &query)
			if err != nil {
				res = backend.ErrorResponseWithErrorSource(err)
			} else {
				res.Frames = append(res.Frames, frames...)
			}
		} else if query.QueryType == MODE_ITEMID {
			frames, err := zabbixDS.queryItemIdData(ctx, &query)
			if err != nil {
				res = backend.ErrorResponseWithErrorSource(err)
			} else {
				res.Frames = append(res.Frames, frames...)
			}
		} else {
			res = backend.ErrorResponseWithErrorSource(backend.DownstreamError(ErrNonMetricQueryNotSupported))
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
