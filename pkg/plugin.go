package main

import (
	"net/http"
	"os"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/cache"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

const ZABBIX_PLUGIN_ID = "alexanderzobnin-zabbix-datasource"

func main() {
	backend.SetupPluginEnvironment(ZABBIX_PLUGIN_ID)

	pluginLogger := log.New()
	mux := http.NewServeMux()
	ds := Init(pluginLogger, mux)
	httpResourceHandler := httpadapter.New(mux)

	pluginLogger.Debug("Starting Zabbix backend datasource")

	err := backend.Serve(backend.ServeOpts{
		CallResourceHandler: httpResourceHandler,
		QueryDataHandler:    ds,
		CheckHealthHandler:  ds,
	})
	if err != nil {
		pluginLogger.Error(err.Error())
	}
}

func Init(logger log.Logger, mux *http.ServeMux) *ZabbixDatasource {
	variableName := "GFX_ZABBIX_DATA_PATH"
	path, exist := os.LookupEnv(variableName)
	if !exist {
		logger.Error("could not read environment variable", variableName)
	} else {
		logger.Debug("environment variable for storage found", "variable", variableName, "value", path)
	}

	ds := &ZabbixDatasource{
		logger:          logger,
		datasourceCache: cache.NewCache(10*time.Minute, 10*time.Minute),
	}

	mux.HandleFunc("/", ds.rootHandler)
	mux.HandleFunc("/zabbix-api", ds.zabbixAPIHandler)
	// mux.Handle("/scenarios", getScenariosHandler(logger))

	return ds
}
