package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
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

func NewDatasource(logger log.Logger, mux *http.ServeMux) *ZabbixDatasource {
	variableName := "GFX_ZABBIX_DATA_PATH"
	path, exist := os.LookupEnv(variableName)
	if !exist {
		logger.Error("could not read environment variable", variableName)
	} else {
		logger.Debug("environment variable for storage found", "variable", variableName, "value", path)
	}

	ds := &ZabbixDatasource{
		logger:          logger,
		datasourceCache: NewCache(10*time.Minute, 10*time.Minute),
	}

	mux.HandleFunc("/", ds.rootHandler)
	mux.HandleFunc("/zabbix-api", ds.zabbixAPIHandler)
	// mux.Handle("/scenarios", getScenariosHandler(logger))

	return ds
}

// CheckHealth checks if the plugin is running properly
func (ds *ZabbixDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}

	// Just checking that the plugin exe is alive and running
	if req.PluginContext.DataSourceInstanceSettings == nil {
		res.Status = backend.HealthStatusOk
		res.Message = "Plugin is running"
		return res, nil
	}

	// TODO?  actually check datasource settings?
	res.Status = backend.HealthStatusOk
	res.Message = "Success"
	return res, nil
}

func (gds *ZabbixDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	qdr := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		res := backend.DataResponse{}
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
func (ds *ZabbixDatasource) GetDatasource(orgID int64, dsInfo *backend.DataSourceInstanceSettings) (*ZabbixDatasourceInstance, error) {
	dsInfoHash := HashDatasourceInfo(dsInfo)

	if cachedData, ok := ds.datasourceCache.Get(dsInfoHash); ok {
		if cachedDS, ok := cachedData.(*ZabbixDatasourceInstance); ok {
			return cachedDS, nil
		}
	}

	ds.logger.Debug(fmt.Sprintf("Datasource cache miss (Org %d Id %d '%s' %s)", orgID, dsInfo.ID, dsInfo.Name, dsInfoHash))

	dsInstance, err := ds.NewZabbixDatasource(dsInfo)
	if err != nil {
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
