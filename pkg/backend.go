package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"runtime/debug"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/net/context"
)

// ZabbixBackend implements the Grafana backend interface and forwards queries to the ZabbixDatasource
type ZabbixPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	logger          hclog.Logger
	datasourceCache *Cache
}

func (p *ZabbixPlugin) newZabbixDatasource(dsInfo *datasource.DatasourceInfo) (*ZabbixDatasource, error) {
	return NewZabbixDatasource(p.logger, dsInfo)
}

// Query receives requests from the Grafana backend. Requests are filtered by query type and sent to the
// applicable ZabbixDatasource.
func (p *ZabbixPlugin) Query(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (resp *datasource.DatasourceResponse, err error) {
	defer func() {
		if r := recover(); r != nil {
			err, _ = r.(error)
			p.logger.Error("Fatal error in Zabbix Plugin Backend", "Error", err)
			p.logger.Error(string(debug.Stack()))
			resp = BuildErrorResponse(fmt.Errorf("Unrecoverable error in grafana-zabbix plugin backend"))
		}
	}()

	zabbixDS, err := p.GetDatasource(tsdbReq)
	if err != nil {
		return nil, err
	}

	queryType, err := GetQueryType(tsdbReq)
	if err != nil {
		return nil, err
	}

	switch queryType {
	case "zabbixAPI":
		resp, err = zabbixDS.ZabbixAPIQuery(ctx, tsdbReq)
	case "query":
		resp, err = zabbixDS.TimeseriesQuery(ctx, tsdbReq)
	case "connectionTest":
		resp, err = zabbixDS.TestConnection(ctx)
	default:
		err = errors.New("Query not implemented")
		return BuildErrorResponse(err), nil
	}

	if resp == nil && err != nil {
		BuildErrorResponse(fmt.Errorf("Internal error in grafana-zabbix plugin"))
	}
	return
}

// GetDatasource Returns cached datasource or creates new one
func (p *ZabbixPlugin) GetDatasource(tsdbReq *datasource.DatasourceRequest) (*ZabbixDatasource, error) {
	dsInfoHash := HashDatasourceInfo(tsdbReq.GetDatasource())

	if cachedData, ok := p.datasourceCache.Get(dsInfoHash); ok {
		if cachedDS, ok := cachedData.(*ZabbixDatasource); ok {
			return cachedDS, nil
		}
	}

	dsInfo := tsdbReq.GetDatasource()
	if p.logger.IsDebug() {
		p.logger.Debug(fmt.Sprintf("Datasource cache miss (Org %d Id %d '%s' %s)", dsInfo.GetOrgId(), dsInfo.GetId(), dsInfo.GetName(), dsInfoHash))
	}

	ds, err := p.newZabbixDatasource(dsInfo)
	if err != nil {
		return nil, err
	}

	p.datasourceCache.Set(dsInfoHash, ds)
	return ds, nil
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

// BuildResponse transforms a Zabbix API response to a DatasourceResponse
func BuildResponse(responseData interface{}) (*datasource.DatasourceResponse, error) {
	jsonBytes, err := json.Marshal(responseData)
	if err != nil {
		return nil, err
	}

	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId:    "zabbixAPI",
				MetaJson: string(jsonBytes),
			},
		},
	}, nil
}

// BuildMetricsResponse builds a response object using a given TimeSeries array
func BuildMetricsResponse(results []*datasource.QueryResult) (*datasource.DatasourceResponse, error) {
	return &datasource.DatasourceResponse{
		Results: results,
	}, nil
}

// BuildErrorResponse creates a QueryResult that forwards an error to the front-end
func BuildErrorResponse(err error) *datasource.DatasourceResponse {
	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId: "zabbixAPI",
				Error: err.Error(),
			},
		},
	}
}
