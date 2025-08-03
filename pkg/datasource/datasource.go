package datasource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/httpclient"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/metrics"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
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
	res.Message = fmt.Sprintf("Zabbix API version %s", message)
	return res, nil
}

func (ds *ZabbixDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	metrics.DataSourceQueryTotal.WithLabelValues("metrics").Inc()
	qdr := backend.NewQueryDataResponse()

	zabbixDS, err := ds.getDSInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	queryTimeout := zabbixDS.Settings.QueryTimeout
	if queryTimeout <= 0 {
		queryTimeout = 60 * time.Second // Default to 60 seconds if not configured
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

		// Generate or retrieve Zabbix API token
		token, err := zabbixDS.zabbix.GetAPI().GenerateUserAPIToken(ctx, userId, zabbixVersion)
		if err != nil {
			return nil, errors.New("failed to generate Zabbix API token for user: " + err.Error())
		}

		zabbixDS.zabbix.GetAPI().SetAuth(token)

		ds.logger.Debug("Per-user authentication enabled", "identity", identity)
	}

	// --- Per-user authentication logic END ---

	for _, q := range req.Queries {
		res := backend.DataResponse{}
		query, err := ReadQuery(q)
		ds.logger.Debug("DS query", "query", q)
		if err != nil {
			res = backend.ErrorResponseWithErrorSource(err)
		} else if err := ValidateTimeRange(query.TimeRange); err != nil {
			// Validate time range before processing any query
			res = backend.ErrorResponseWithErrorSource(err)
		} else {
			// Create a context with timeout for this specific query
			queryCtx, cancel := context.WithTimeout(ctx, queryTimeout)

			// Execute query with timeout context in an anonymous function to ensure cancel is called after each iteration
			func() {
				defer cancel()

				var frames []*data.Frame
				var queryErr error

				switch query.QueryType {
				case MODE_METRICS:
					frames, queryErr = zabbixDS.queryNumericItems(queryCtx, &query)
				case MODE_ITEMID:
					frames, queryErr = zabbixDS.queryItemIdData(queryCtx, &query)
				default:
					queryErr = backend.DownstreamError(ErrNonMetricQueryNotSupported)
				}

				// Check if query timed out
				if queryErr != nil {
					if errors.Is(queryCtx.Err(), context.DeadlineExceeded) {
						// Query exceeded the configured timeout
						timeoutMsg := fmt.Sprintf(
							"Query execution exceeded maximum allowed time (%v). Query was automatically terminated to prevent excessive resource consumption.",
							queryTimeout,
						)
						ds.logger.Warn(
							"Query timeout exceeded",
							"refId", q.RefID,
							"queryType", query.QueryType,
							"timeout", queryTimeout,
							"datasourceUID", req.PluginContext.DataSourceInstanceSettings.UID,
						)
						res = backend.ErrorResponseWithErrorSource(
							backend.DownstreamError(fmt.Errorf("query timeout: %s", timeoutMsg)),
						)
						res.Status = http.StatusRequestTimeout
					} else {
						res = backend.ErrorResponseWithErrorSource(queryErr)
					}
				} else {
					res.Frames = append(res.Frames, frames...)
				}
			}()
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
