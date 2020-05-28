package main

import (
	"encoding/json"
	"io/ioutil"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

func (ds *ZabbixDatasource) rootHandler(rw http.ResponseWriter, req *http.Request) {
	ds.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	rw.Write([]byte("Hello from Zabbix data source!"))
	rw.WriteHeader(http.StatusOK)
}

func (ds *ZabbixDatasource) zabbixAPIHandler(rw http.ResponseWriter, req *http.Request) {
	ds.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	if req.Method != http.MethodPost {
		return
	}

	body, err := ioutil.ReadAll(req.Body)
	defer req.Body.Close()
	if err != nil || len(body) == 0 {
		rw.WriteHeader(http.StatusBadRequest)
	}

	var reqData ZabbixAPIResourceRequest
	err = json.Unmarshal(body, &reqData)

	pluginCxt := httpadapter.PluginConfigFromContext(req.Context())
	ds.logger.Debug("Received Zabbix API call", "ds", pluginCxt.DataSourceInstanceSettings.Name)

	dsInstance, err := ds.GetDatasource(pluginCxt.OrgID, pluginCxt.DataSourceInstanceSettings)
	ds.logger.Debug("Data source found", "ds", dsInstance.dsInfo.Name)

	apiReq := &ZabbixAPIRequest{Method: reqData.Method, Params: reqData.Params}
	result, err := dsInstance.ZabbixAPIQuery(req.Context(), apiReq)
	resultJson, err := json.Marshal(*result)
	ds.logger.Debug("Got response", "result", result)

	ds.logger.Debug("Received Zabbix API call", "ds", reqData.DatasourceId, "method", reqData.Method, "params", reqData.Params)

	rw.Write(resultJson)
	rw.WriteHeader(http.StatusOK)
}
