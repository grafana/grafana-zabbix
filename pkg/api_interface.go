package main

import (
	"encoding/json"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	"golang.org/x/net/context"
)

// ZabbixAPIInterface describes an interface for interacting with the Zabbix aPI
type ZabbixAPIInterface interface {
	// DirectQuery handles query requests to Zabbix
	// DirectQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error)
	// TestConnection checks authentication and version of the Zabbix API and returns that info
	// TestConnection(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error)

	// APIRequest checks authentication and makes a request to the Zabbix API
	APIRequest(ctx context.Context, method string, params ZabbixAPIParams) (result json.RawMessage, err error)
	GetFilteredItems(ctx context.Context, hostids []string, appids []string, itemtype string) (zabbix.Items, error)
	GetAppsByHostIDs(ctx context.Context, hostids []string) (zabbix.Applications, error)
	GetHostsByGroupIDs(ctx context.Context, groupids []string) (zabbix.Hosts, error)
	GetAllGroups(ctx context.Context) (zabbix.Groups, error)
	GetHistory(ctx context.Context, tsdbReq *datasource.DatasourceRequest, items zabbix.Items) (zabbix.History, error)
	GetTrend(ctx context.Context, tsdbReq *datasource.DatasourceRequest, items zabbix.Items) (zabbix.Trend, error)
}
