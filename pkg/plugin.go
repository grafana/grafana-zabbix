package main

import (
	"net/http"
	"os"
	"strconv"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/datasource"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

const ZABBIX_PLUGIN_ID = "alexanderzobnin-zabbix-datasource"

const (
	DefaultMaxReceiveMsgSizeMB = 32
	DefaultMaxSendMsgSizeMB    = 100
)

const (
	EnvMaxReceiveMsgSize = "GF_PLUGIN_ALEXANDERZOBNIN_ZABBIX_DATASOURCE_GRPC_MAX_RECEIVE_MSG_SIZE_MB"
	EnvMaxSendMsgSize    = "GF_PLUGIN_ALEXANDERZOBNIN_ZABBIX_DATASOURCE_GRPC_MAX_SEND_MSG_SIZE_MB"
)

func main() {
	backend.SetupPluginEnvironment(ZABBIX_PLUGIN_ID)
	pluginLogger := log.New()

	pluginLogger.Debug("Starting Zabbix datasource")

	maxReceiveMsgSizeMB := getIntFromEnv(EnvMaxReceiveMsgSize, DefaultMaxReceiveMsgSizeMB)
	maxSendMsgSizeMB := getIntFromEnv(EnvMaxSendMsgSize, DefaultMaxSendMsgSizeMB)

	mux := http.NewServeMux()
	ds := Init(pluginLogger, mux)
	httpResourceHandler := httpadapter.New(mux)

	err := backend.Manage(ZABBIX_PLUGIN_ID, backend.ServeOpts{
		CallResourceHandler: httpResourceHandler,
		QueryDataHandler:    ds,
		CheckHealthHandler:  ds,
		GRPCSettings: backend.GRPCSettings{
			MaxReceiveMsgSize: maxReceiveMsgSizeMB * 1024 * 1024,
			MaxSendMsgSize:    maxSendMsgSizeMB * 1024 * 1024,
		},
	})
	if err != nil {
		pluginLogger.Error("Error starting Zabbix datasource", "error", err.Error())
	}
}

func Init(logger log.Logger, mux *http.ServeMux) *datasource.ZabbixDatasource {
	ds := datasource.NewZabbixDatasource()

	mux.HandleFunc("/", ds.RootHandler)
	mux.HandleFunc("/zabbix-api", ds.ZabbixAPIHandler)
	mux.HandleFunc("/db-connection-post", ds.DBConnectionPostProcessingHandler)

	return ds
}

func getIntFromEnv(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}

	intVal, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}

	return intVal
}
