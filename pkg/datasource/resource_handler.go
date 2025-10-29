package datasource

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// Resource handler describes handlers for the resources populated by plugin in plugin.go, like:
// mux.HandleFunc("/", ds.RootHandler)
// mux.HandleFunc("/zabbix-api", ds.ZabbixAPIHandler)

func (ds *ZabbixDatasource) RootHandler(rw http.ResponseWriter, req *http.Request) {
	ds.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	_, err := rw.Write([]byte("Hello from Zabbix data source!"))
	if err != nil {
		ds.logger.Warn("Error writing response")
	}

	rw.WriteHeader(http.StatusOK)
}

func (ds *ZabbixDatasource) ZabbixAPIHandler(rw http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		return
	}

	body, err := io.ReadAll(req.Body)
	defer req.Body.Close()
	if err != nil || len(body) == 0 {
		writeError(rw, http.StatusBadRequest, err)
		return
	}

	var reqData ZabbixAPIResourceRequest
	err = json.Unmarshal(body, &reqData)
	if err != nil {
		ds.logger.Error("Cannot unmarshal request", "error", err.Error())
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	ctx := req.Context()
	pluginCxt := backend.PluginConfigFromContext(ctx)
	dsInstance, err := ds.getDSInstance(ctx, pluginCxt)
	if err != nil {
		ds.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	// Apply per-user authentication with caching
	err = ds.applyPerUserAuth(ctx, dsInstance, pluginCxt.DataSourceInstanceSettings.UID)
	if err != nil {
		ds.logger.Error("Per-user authentication failed", "error", err)
		writeError(rw, http.StatusForbidden, err)
		return
	}

	apiReq := &zabbix.ZabbixAPIRequest{Method: reqData.Method, Params: reqData.Params}

	result, err := dsInstance.ZabbixAPIQuery(req.Context(), apiReq)
	if err != nil {
		ds.logger.Error("Zabbix API request error", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	writeResponse(rw, result)
}

func (ds *ZabbixDatasource) DBConnectionPostProcessingHandler(rw http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		return
	}

	body, err := io.ReadAll(req.Body)
	defer req.Body.Close()
	if err != nil || len(body) == 0 {
		writeError(rw, http.StatusBadRequest, err)
		return
	}

	var reqData DBConnectionPostProcessingRequest
	err = json.Unmarshal(body, &reqData)
	if err != nil {
		ds.logger.Error("Cannot unmarshal request", "error", err.Error())
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	ctx := req.Context()
	pluginCxt := backend.PluginConfigFromContext(ctx)
	dsInstance, err := ds.getDSInstance(ctx, pluginCxt)
	if err != nil {
		ds.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	// Apply per-user authentication with caching
	err = ds.applyPerUserAuth(ctx, dsInstance, pluginCxt.DataSourceInstanceSettings.UID)
	if err != nil {
		ds.logger.Error("Per-user authentication failed", "error", err)
		writeError(rw, http.StatusForbidden, err)
		return
	}

	reqData.Query.TimeRange.From = time.Unix(reqData.TimeRange.From, 0)
	reqData.Query.TimeRange.To = time.Unix(reqData.TimeRange.To, 0)

	frames, err := dsInstance.applyDataProcessing(req.Context(), &reqData.Query, reqData.Series, true)
	if err != nil {
		writeError(rw, http.StatusInternalServerError, err)
	}

	resultJson, err := json.Marshal(frames)
	if err != nil {
		writeError(rw, http.StatusInternalServerError, err)
	}

	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)

	_, err = rw.Write(resultJson)
	if err != nil {
		ds.logger.Warn("Error writing response")
	}

}

func writeResponse(rw http.ResponseWriter, result *ZabbixAPIResourceResponse) {
	resultJson, err := json.Marshal(*result)
	if err != nil {
		writeError(rw, http.StatusInternalServerError, err)
	}

	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)

	_, err = rw.Write(resultJson)
	if err != nil {
		log.DefaultLogger.Warn("Error writing response")
	}
}

func writeError(rw http.ResponseWriter, statusCode int, err error) {
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

	_, err = rw.Write(b)
	if err != nil {
		log.DefaultLogger.Warn("Error writing response")
	}
}
