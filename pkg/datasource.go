package main

import (
	"errors"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/net/context"
)

type ZabbixDatasource struct {
	plugin.NetRPCUnsupportedPlugin
	logger hclog.Logger
}

func (ds *ZabbixDatasource) Query(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	queryType, err := GetQueryType(tsdbReq)
	if err != nil {
		return nil, err
	}

	dsInfo := tsdbReq.GetDatasource()
	ds.logger.Debug("createRequest", "dsInfo", dsInfo)

	ds.logger.Debug("createRequest", "queryType", queryType)

	switch queryType {
	case "zabbixAPI":
		return ds.ZabbixAPIQuery(ctx, tsdbReq)
	default:
		return nil, errors.New("Query is not implemented yet")
	}
}

func GetQueryType(tsdbReq *datasource.DatasourceRequest) (string, error) {
	queryType := "query"
	if len(tsdbReq.Queries) > 0 {
		firstQuery := tsdbReq.Queries[0]
		queryJson, err := simplejson.NewJson([]byte(firstQuery.ModelJson))
		if err != nil {
			return "", err
		}
		queryType = queryJson.Get("queryType").MustString("query")
	}
	return queryType, nil
}

func (ds *ZabbixDatasource) ZabbixAPIQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	jsonQueries := make([]*simplejson.Json, 0)
	for _, query := range tsdbReq.Queries {
		json, err := simplejson.NewJson([]byte(query.ModelJson))
		apiMethod := json.GetPath("target", "method").MustString()
		apiParams := json.GetPath("target", "params")

		if err != nil {
			return nil, err
		}

		ds.logger.Debug("ZabbixAPIQuery", "method", apiMethod, "params", apiParams)

		jsonQueries = append(jsonQueries, json)
	}

	return nil, errors.New("ZabbixAPIQuery is not implemented yet")
}
