package datasource

import (
	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

var basicDatasourceInfo = &backend.DataSourceInstanceSettings{
	ID:       1,
	Name:     "TestDatasource",
	URL:      "http://zabbix.org/zabbix",
	JSONData: []byte(`{"username":"username", "password":"password", "cacheTTL":"10m", "authType":"token"}`),
}

func MockZabbixDataSource(body string, statusCode int) *ZabbixDatasourceInstance {
	zabbixSettings, _ := settings.ReadZabbixSettings(basicDatasourceInfo)
	zabbixClient, _ := zabbix.MockZabbixClient(basicDatasourceInfo, body, statusCode)

	return &ZabbixDatasourceInstance{
		dsInfo:   basicDatasourceInfo,
		zabbix:   zabbixClient,
		Settings: zabbixSettings,
		logger:   log.New(),
	}
}

func MockZabbixDataSourceResponse(dsInstance *ZabbixDatasourceInstance, body string, statusCode int) *ZabbixDatasourceInstance {
	zabbixClient, _ := zabbix.MockZabbixClientResponse(dsInstance.zabbix, body, statusCode)
	dsInstance.zabbix = zabbixClient

	return dsInstance
}
