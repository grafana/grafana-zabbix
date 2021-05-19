package datasource

import (
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/cache"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

var emptyParams = map[string]interface{}{}

var basicDatasourceInfo = &backend.DataSourceInstanceSettings{
	ID:       1,
	Name:     "TestDatasource",
	URL:      "http://zabbix.org/zabbix",
	JSONData: []byte(`{"username":"username", "password":"password", "cacheTTL":"10m"}`),
}

func mockZabbixQuery(method string, params ZabbixAPIParams) *zabbix.ZabbixAPIRequest {
	return &zabbix.ZabbixAPIRequest{
		Method: method,
		Params: params,
	}
}

func MockZabbixDataSource(body string, statusCode int) *ZabbixDatasourceInstance {
	zabbixSettings, _ := readZabbixSettings(basicDatasourceInfo)
	zabbixClient, _ := zabbix.MockZabbixClient(basicDatasourceInfo, body, statusCode)

	return &ZabbixDatasourceInstance{
		dsInfo:     basicDatasourceInfo,
		zabbix:     zabbixClient,
		Settings:   zabbixSettings,
		queryCache: NewDatasourceCache(cache.NoExpiration, 10*time.Minute),
		logger:     log.New(),
	}
}

func MockZabbixDataSourceResponse(dsInstance *ZabbixDatasourceInstance, body string, statusCode int) *ZabbixDatasourceInstance {
	zabbixClient, _ := zabbix.MockZabbixClientResponse(dsInstance.zabbix, body, statusCode)
	dsInstance.zabbix = zabbixClient

	return dsInstance
}
