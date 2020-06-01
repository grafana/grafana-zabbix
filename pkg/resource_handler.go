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
	if req.Method != http.MethodPost {
		return
	}

	body, err := ioutil.ReadAll(req.Body)
	defer req.Body.Close()
	if err != nil || len(body) == 0 {
		WriteError(rw, http.StatusBadRequest, err)
		return
	}

	var reqData ZabbixAPIResourceRequest
	err = json.Unmarshal(body, &reqData)
	if err != nil {
		ds.logger.Error("Cannot unmarshal request", "error", err.Error())
		WriteError(rw, http.StatusInternalServerError, err)
		return
	}

	pluginCxt := httpadapter.PluginConfigFromContext(req.Context())
	dsInstance, err := ds.GetDatasource(pluginCxt)

	apiReq := &ZabbixAPIRequest{Method: reqData.Method, Params: reqData.Params}

	result, err := dsInstance.ZabbixAPIQuery(req.Context(), apiReq)
	if err != nil {
		ds.logger.Error("Zabbix API request error", "error", err)
		WriteError(rw, http.StatusInternalServerError, err)
		return
	}

	WriteResponse(rw, result)
}

func WriteResponse(rw http.ResponseWriter, result *ZabbixAPIResourceResponse) {
	resultJson, err := json.Marshal(*result)
	if err != nil {
		WriteError(rw, http.StatusInternalServerError, err)
	}

	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)
	rw.Write(resultJson)
}

func WriteError(rw http.ResponseWriter, statusCode int, err error) {
	data := make(map[string]interface{})

	data["error"] = "Internal Server Error"
	data["message"] = err.Error()

	var b []byte
	if b, err = json.Marshal(data); err != nil {
		rw.WriteHeader(statusCode)
		return
	}

	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusInternalServerError)
	rw.Write(b)
}
