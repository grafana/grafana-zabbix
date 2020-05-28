package main

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

const ZABBIX_PLUGIN_ID = "alexanderzobnin-zabbix-datasource"

func main() {
	backend.SetupPluginEnvironment(ZABBIX_PLUGIN_ID)

	pluginLogger := log.New()
	mux := http.NewServeMux()
	ds := NewDatasource(pluginLogger, mux)
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

	// plugin.Serve(&plugin.ServeConfig{

	// 	HandshakeConfig: plugin.HandshakeConfig{
	// 		ProtocolVersion:  1,
	// 		MagicCookieKey:   "grafana_plugin_type",
	// 		MagicCookieValue: "datasource",
	// 	},
	// 	Plugins: map[string]plugin.Plugin{
	// 		"zabbix-backend-datasource": &datasource.DatasourcePluginImpl{Plugin: &ZabbixPlugin{
	// 			datasourceCache: NewCache(10*time.Minute, 10*time.Minute),
	// 			logger:          pluginLogger,
	// 		}},
	// 	},

	// 	// A non-nil value here enables gRPC serving for this plugin...
	// 	GRPCServer: plugin.DefaultGRPCServer,
	// })
}
