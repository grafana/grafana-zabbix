package zabbix

import (
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func MockZabbixClient(dsInfo *backend.DataSourceInstanceSettings, body string, statusCode int) (*Zabbix, error) {
	zabbixAPI, err := zabbixapi.MockZabbixAPI(body, statusCode)
	if err != nil {
		return nil, err
	}

	client, err := New(dsInfo, zabbixAPI)
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
