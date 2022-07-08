package zabbix

import (
	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"time"
)

func MockZabbixClient(dsInfo *backend.DataSourceInstanceSettings, body string, statusCode int) (*Zabbix, error) {
	zabbixAPI, err := zabbixapi.MockZabbixAPI(body, statusCode)
	if err != nil {
		return nil, err
	}
	zabbixSettings := &settings.ZabbixDatasourceSettings{
		Timeout: 10 * time.Second,
	}

	client, err := New(dsInfo, zabbixSettings, zabbixAPI)
	if err != nil {
		return nil, err
	}

	return client, nil
}

func MockZabbixClientResponse(client *Zabbix, body string, statusCode int) (*Zabbix, error) {
	zabbixAPI, err := zabbixapi.MockZabbixAPI(body, statusCode)
	if err != nil {
		return nil, err
	}

	client.api = zabbixAPI

	return client, nil
}
