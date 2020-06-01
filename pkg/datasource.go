package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"
	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ZabbixPlugin implements the Grafana backend interface and forwards queries to the ZabbixDatasourceInstance
type ZabbixPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	logger          hclog.Logger
	datasourceCache *Cache
}

type ZabbixDatasource struct {
	datasourceCache *Cache
	logger          log.Logger
}

// ZabbixDatasourceInstance stores state about a specific datasource and provides methods to make
// requests to the Zabbix API
type ZabbixDatasourceInstance struct {
	url        *url.URL
	authToken  string
	dsInfo     *backend.DataSourceInstanceSettings
	Settings   *ZabbixDatasourceSettings
	queryCache *Cache
	httpClient *http.Client
	logger     log.Logger
}

// CheckHealth checks if the plugin is running properly
func (ds *ZabbixDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}

	dsInstance, err := ds.GetDatasource(req.PluginContext)
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
		ds.logger.Error("Error connecting zabbix", "err", err)
		return res, nil
	}

	res.Status = backend.HealthStatusOk
	res.Message = message
	return res, nil
}

func (ds *ZabbixDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	qdr := backend.NewQueryDataResponse()

	zabbixDS, err := ds.GetDatasource(req.PluginContext)
	if err != nil {
		return nil, err
	}

	for _, q := range req.Queries {
		res := backend.DataResponse{}
		query, err := ReadQuery(q)
		ds.logger.Debug("DS query", "query", q)
		ds.logger.Debug("DS query parsed", "query", query)
		if err != nil {
			res.Error = err
		} else if len(query.Functions) > 0 {
			res.Error = errors.New("Zabbix queries with functions are not supported")
		} else if query.Mode != 0 {
			res.Error = errors.New("Non-metrics queries are not supported")
		} else {
			frame, err := zabbixDS.queryNumericItems(ctx, &query)
			ds.logger.Debug("DS got frame", "frame", frame)
			if err != nil {
				res.Error = err
			} else {
				res.Frames = []*data.Frame{frame}
			}
		}
		qdr.Responses[q.RefID] = res
	}

	return qdr, nil
}

// func (p *ZabbixPlugin) GetDatasourceById(datasourceId int64) (*ZabbixDatasourceInstance, error) {
// }

func (ds *ZabbixDatasource) NewZabbixDatasource(dsInfo *backend.DataSourceInstanceSettings) (*ZabbixDatasourceInstance, error) {
	dsInstance, err := newZabbixDatasource(dsInfo)
	if err != nil {
		return nil, err
	}

	dsInstance.logger = ds.logger
	return dsInstance, nil
}

// newZabbixDatasource returns an initialized ZabbixDatasource
func newZabbixDatasource(dsInfo *backend.DataSourceInstanceSettings) (*ZabbixDatasourceInstance, error) {
	zabbixURLStr := dsInfo.URL
	zabbixURL, err := url.Parse(zabbixURLStr)
	if err != nil {
		return nil, err
	}

	zabbixSettings, err := readZabbixSettings(dsInfo)
	if err != nil {
		return nil, err
	}

	return &ZabbixDatasourceInstance{
		url:        zabbixURL,
		dsInfo:     dsInfo,
		Settings:   zabbixSettings,
		queryCache: NewCache(10*time.Minute, 10*time.Minute),
		httpClient: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					Renegotiation: tls.RenegotiateFreelyAsClient,
				},
				Proxy: http.ProxyFromEnvironment,
				Dial: (&net.Dialer{
					Timeout:   30 * time.Second,
					KeepAlive: 30 * time.Second,
				}).Dial,
				TLSHandshakeTimeout:   10 * time.Second,
				ExpectContinueTimeout: 1 * time.Second,
				MaxIdleConns:          100,
				IdleConnTimeout:       90 * time.Second,
			},
			Timeout: time.Duration(time.Second * 30),
		},
	}, nil
}

func readZabbixSettings(dsInstanceSettings *backend.DataSourceInstanceSettings) (*ZabbixDatasourceSettings, error) {
	zabbixSettingsDTO := &ZabbixDatasourceSettingsDTO{
		TrendsFrom:  "7d",
		TrendsRange: "4d",
		CacheTTL:    "1h",
	}

	err := json.Unmarshal(dsInstanceSettings.JSONData, &zabbixSettingsDTO)
	if err != nil {
		return nil, err
	}

	trendsFrom, err := gtime.ParseInterval(zabbixSettingsDTO.TrendsFrom)
	if err != nil {
		return nil, err
	}

	trendsRange, err := gtime.ParseInterval(zabbixSettingsDTO.TrendsRange)
	if err != nil {
		return nil, err
	}

	cacheTTL, err := gtime.ParseInterval(zabbixSettingsDTO.CacheTTL)
	if err != nil {
		return nil, err
	}

	zabbixSettings := &ZabbixDatasourceSettings{
		Trends:      zabbixSettingsDTO.Trends,
		TrendsFrom:  trendsFrom,
		TrendsRange: trendsRange,
		CacheTTL:    cacheTTL,
	}

	return zabbixSettings, nil
}

// Query receives requests from the Grafana backend. Requests are filtered by query type and sent to the
// applicable ZabbixDatasource.
// func (p *ZabbixPlugin) Query(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (resp *datasource.DatasourceResponse, err error) {
// 	zabbixDS, err := p.GetDatasource(tsdbReq)
// 	if err != nil {
// 		return nil, err
// 	}

// 	queryType, err := GetQueryType(tsdbReq)
// 	if err != nil {
// 		return nil, err
// 	}

// 	switch queryType {
// 	case "zabbixAPI":
// 		resp, err = zabbixDS.ZabbixAPIQuery(ctx, tsdbReq)
// 	case "query":
// 		resp, err = zabbixDS.queryNumericItems(ctx, tsdbReq)
// 	case "connectionTest":
// 		resp, err = zabbixDS.TestConnection(ctx, tsdbReq)
// 	default:
// 		err = errors.New("Query not implemented")
// 		return BuildErrorResponse(err), nil
// 	}

// 	return
// }

// GetDatasource Returns cached datasource or creates new one
func (ds *ZabbixDatasource) GetDatasource(pluginContext backend.PluginContext) (*ZabbixDatasourceInstance, error) {
	dsSettings := pluginContext.DataSourceInstanceSettings
	dsInfoHash := HashDatasourceInfo(dsSettings)

	if cachedData, ok := ds.datasourceCache.Get(dsInfoHash); ok {
		if cachedDS, ok := cachedData.(*ZabbixDatasourceInstance); ok {
			return cachedDS, nil
		}
	}

	ds.logger.Debug(fmt.Sprintf("Datasource cache miss (Org %d Id %d '%s' %s)", pluginContext.OrgID, dsSettings.ID, dsSettings.Name, dsInfoHash))

	dsInstance, err := ds.NewZabbixDatasource(pluginContext.DataSourceInstanceSettings)
	if err != nil {
		ds.logger.Error("Error initializing datasource", "error", err)
		return nil, err
	}

	ds.datasourceCache.Set(dsInfoHash, dsInstance)
	return dsInstance, nil
}

// GetQueryType determines the query type from a query or list of queries
func GetQueryType(tsdbReq *datasource.DatasourceRequest) (string, error) {
	queryType := "query"
	if len(tsdbReq.Queries) > 0 {
		firstQuery := tsdbReq.Queries[0]
		queryJSON, err := simplejson.NewJson([]byte(firstQuery.ModelJson))
		if err != nil {
			return "", err
		}
		queryType = queryJSON.Get("queryType").MustString("query")
	}
	return queryType, nil
}

// // BuildDataResponse transforms a Zabbix API response to the QueryDataResponse
// func BuildDataResponse(responseData interface{}) (*backend.QueryDataResponse, error) {
// 	jsonBytes, err := json.Marshal(responseData)
// 	if err != nil {
// 		return nil, err
// 	}

// 	return &backend.QueryDataResponse{
// 		Responses: map[string]backend.DataResponse{
// 			"zabbixAPI": {
// 				Frames: ,
// 			}
// 		},
// 	}, nil
// }

func BuildAPIResponse(responseData *interface{}) (*ZabbixAPIResourceResponse, error) {
	return &ZabbixAPIResourceResponse{
		Result: *responseData,
	}, nil
}

// BuildResponse transforms a Zabbix API response to a DatasourceResponse
func BuildResponse(responseData interface{}) (*datasource.DatasourceResponse, error) {
	jsonBytes, err := json.Marshal(responseData)
	if err != nil {
		return nil, err
	}

	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			{
				RefId:    "zabbixAPI",
				MetaJson: string(jsonBytes),
			},
		},
	}, nil
}

// BuildErrorResponse creates a QueryResult that forwards an error to the front-end
func BuildErrorResponse(err error) *datasource.DatasourceResponse {
	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			{
				RefId: "zabbixAPI",
				Error: err.Error(),
			},
		},
	}
}

// BuildMetricsResponse builds a response object using a given TimeSeries array
func BuildMetricsResponse(metrics []*datasource.TimeSeries) (*datasource.DatasourceResponse, error) {
	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			{
				RefId:  "zabbixMetrics",
				Series: metrics,
			},
		},
	}, nil
}
