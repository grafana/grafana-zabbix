package main

import (
	"encoding/json"
	"errors"
	"fmt"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/net/context"
)

// ZabbixBackend implements the Grafana backend interface and forwards queries to the ZabbixDatasource
type ZabbixBackend struct {
	plugin.NetRPCUnsupportedPlugin
	logger          hclog.Logger
	datasourceCache *Cache
}

func (b *ZabbixBackend) newZabbixDatasource() *ZabbixDatasource {
	ds := NewZabbixDatasource()
	ds.logger = b.logger
	return ds
}

// Query receives requests from the Grafana backend. Requests are filtered by query type and sent to the
// applicable ZabbixDatasource.
func (b *ZabbixBackend) Query(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	zabbixDs := b.getCachedDatasource(tsdbReq)

	queryType, err := GetQueryType(tsdbReq)
	if err != nil {
		return nil, err
	}

	switch queryType {
	case "zabbixAPI":
		return zabbixDs.ZabbixAPIQuery(ctx, tsdbReq)
	case "connectionTest":
		return zabbixDs.TestConnection(ctx, tsdbReq)
	default:
		err = errors.New("Query not implemented")
		return BuildErrorResponse(err), nil
	}
}

func (b *ZabbixBackend) getCachedDatasource(tsdbReq *datasource.DatasourceRequest) *ZabbixDatasource {
	dsInfoHash := HashDatasourceInfo(tsdbReq.GetDatasource())

	if cachedData, ok := b.datasourceCache.Get(dsInfoHash); ok {
		if cachedDS, ok := cachedData.(*ZabbixDatasource); ok {
			return cachedDS
		}
	}

	if b.logger.IsDebug() {
		dsInfo := tsdbReq.GetDatasource()
		b.logger.Debug(fmt.Sprintf("Datasource cache miss (Org %d Id %d '%s' %s)", dsInfo.GetOrgId(), dsInfo.GetId(), dsInfo.GetName(), dsInfoHash))
	}
	return b.newZabbixDatasource()
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
