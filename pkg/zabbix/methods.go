package zabbix

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (ds *Zabbix) GetHistory(ctx context.Context, items []*Item, timeRange backend.TimeRange) (History, error) {
	history := History{}
	// Zabbix stores history in different tables and `history` param required for query. So in one query it's only
	// possible to get history for items with one type. In order to get history for items with multple types (numeric unsigned and numeric float),
	// items should be grouped by the `value_type` field.
	groupedItemids := make(map[int][]string, 0)
	for _, item := range items {
		groupedItemids[item.ValueType] = append(groupedItemids[item.ValueType], item.ID)
	}

	for historyType, itemids := range groupedItemids {
		result, err := ds.getHistory(ctx, itemids, historyType, timeRange)
		if err != nil {
			return nil, err
		}

		history = append(history, result...)
	}

	return history, nil
}

func (ds *Zabbix) getHistory(ctx context.Context, itemids []string, historyType int, timeRange backend.TimeRange) (History, error) {
	params := ZabbixAPIParams{
		"output":    "extend",
		"itemids":   itemids,
		"history":   historyType,
		"time_from": timeRange.From.Unix(),
		"time_till": timeRange.To.Unix(),
		"sortfield": "clock",
		"sortorder": "ASC",
	}

	result, err := ds.Request(ctx, &ZabbixAPIRequest{Method: "history.get", Params: params})
	if err != nil {
		return nil, err
	}

	var history History
	err = convertTo(result, &history)
	return history, err
}

func (ds *Zabbix) GetTrend(ctx context.Context, items []*Item, timeRange backend.TimeRange) (Trend, error) {
	itemids := make([]string, 0)
	for _, item := range items {
		itemids = append(itemids, item.ID)
	}

	return ds.getTrend(ctx, itemids, timeRange)
}

func (ds *Zabbix) getTrend(ctx context.Context, itemids []string, timeRange backend.TimeRange) (Trend, error) {
	params := ZabbixAPIParams{
		"output":    "extend",
		"itemids":   itemids,
		"time_from": timeRange.From.Unix(),
		"time_till": timeRange.To.Unix(),
		"sortfield": "clock",
		"sortorder": "ASC",
	}

	result, err := ds.Request(ctx, &ZabbixAPIRequest{Method: "trend.get", Params: params})
	if err != nil {
		return nil, err
	}

	var trend Trend
	err = convertTo(result, &trend)
	return trend, err
}

func (ds *Zabbix) GetItems(ctx context.Context, groupFilter string, hostFilter string, appFilter string, itemFilter string, itemType string) ([]*Item, error) {
	hosts, err := ds.GetHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for _, host := range hosts {
		hostids = append(hostids, host.ID)
	}

	apps, err := ds.GetApps(ctx, groupFilter, hostFilter, appFilter)
	// Apps not supported in Zabbix 5.4 and higher
	if isAppMethodNotFoundError(err) {
		apps = []Application{}
	} else if err != nil {
		return nil, err
	}
	var appids []string
	for _, app := range apps {
		appids = append(appids, app.ID)
	}

	var allItems []*Item
	if len(hostids) > 0 {
		allItems, err = ds.GetAllItems(ctx, hostids, nil, itemType)
	} else if len(appids) > 0 {
		allItems, err = ds.GetAllItems(ctx, nil, appids, itemType)
	}

	return filterItemsByQuery(allItems, itemFilter)
}

func filterItemsByQuery(items []*Item, filter string) ([]*Item, error) {
	re, err := parseFilter(filter)
	if err != nil {
		return nil, err
	}

	var filteredItems []*Item
	for _, i := range items {
		name := i.Name
		if re != nil {
			if re.MatchString(name) {
				filteredItems = append(filteredItems, i)
			}
		} else if name == filter {
			filteredItems = append(filteredItems, i)
		}

	}

	return filteredItems, nil
}

func (ds *Zabbix) GetApps(ctx context.Context, groupFilter string, hostFilter string, appFilter string) ([]Application, error) {
	hosts, err := ds.GetHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for _, host := range hosts {
		hostids = append(hostids, host.ID)
	}
	allApps, err := ds.GetAllApps(ctx, hostids)
	if err != nil {
		return nil, err
	}

	return filterAppsByQuery(allApps, appFilter)
}

func filterAppsByQuery(items []Application, filter string) ([]Application, error) {
	re, err := parseFilter(filter)
	if err != nil {
		return nil, err
	}

	var filteredItems []Application
	for _, i := range items {
		name := i.Name
		if re != nil {
			if re.MatchString(name) {
				filteredItems = append(filteredItems, i)
			}
		} else if name == filter {
			filteredItems = append(filteredItems, i)
		}

	}

	return filteredItems, nil
}

func (ds *Zabbix) GetHosts(ctx context.Context, groupFilter string, hostFilter string) ([]Host, error) {
	groups, err := ds.GetGroups(ctx, groupFilter)
	if err != nil {
		return nil, err
	}
	var groupids []string
	for _, group := range groups {
		groupids = append(groupids, group.ID)
	}
	allHosts, err := ds.GetAllHosts(ctx, groupids)
	if err != nil {
		return nil, err
	}

	return filterHostsByQuery(allHosts, hostFilter)
}

func filterHostsByQuery(items []Host, filter string) ([]Host, error) {
	re, err := parseFilter(filter)
	if err != nil {
		return nil, err
	}

	var filteredItems []Host
	for _, i := range items {
		name := i.Name
		if re != nil {
			if re.MatchString(name) {
				filteredItems = append(filteredItems, i)
			}
		} else if name == filter {
			filteredItems = append(filteredItems, i)
		}

	}

	return filteredItems, nil
}

func (ds *Zabbix) GetGroups(ctx context.Context, groupFilter string) ([]Group, error) {
	allGroups, err := ds.GetAllGroups(ctx)
	if err != nil {
		return nil, err
	}

	return filterGroupsByQuery(allGroups, groupFilter)
}

func filterGroupsByQuery(items []Group, filter string) ([]Group, error) {
	re, err := parseFilter(filter)
	if err != nil {
		return nil, err
	}

	var filteredItems []Group
	for _, i := range items {
		name := i.Name
		if re != nil {
			if re.MatchString(name) {
				filteredItems = append(filteredItems, i)
			}
		} else if name == filter {
			filteredItems = append(filteredItems, i)
		}

	}

	return filteredItems, nil
}

func (ds *Zabbix) GetAllItems(ctx context.Context, hostids []string, appids []string, itemtype string) ([]*Item, error) {
	params := ZabbixAPIParams{
		"output":         []string{"itemid", "name", "key_", "value_type", "hostid", "status", "state"},
		"sortfield":      "name",
		"webitems":       true,
		"filter":         map[string]interface{}{},
		"selectHosts":    []string{"hostid", "name"},
		"hostids":        hostids,
		"applicationids": appids,
	}

	filter := params["filter"].(map[string]interface{})
	if itemtype == "num" {
		filter["value_type"] = []int{0, 3}
	} else if itemtype == "text" {
		filter["value_type"] = []int{1, 2, 4}
	}

	result, err := ds.Request(ctx, &ZabbixAPIRequest{Method: "item.get", Params: params})
	if err != nil {
		return nil, err
	}

	var items []*Item
	err = convertTo(result, &items)
	if err != nil {
		return nil, err
	}

	items = expandItems(items)
	return items, err
}

func (ds *Zabbix) GetAllApps(ctx context.Context, hostids []string) ([]Application, error) {
	params := ZabbixAPIParams{
		"output":  "extend",
		"hostids": hostids,
	}

	result, err := ds.Request(ctx, &ZabbixAPIRequest{Method: "application.get", Params: params})
	if err != nil {
		return nil, err
	}

	var apps []Application
	err = convertTo(result, &apps)
	return apps, err
}

func (ds *Zabbix) GetAllHosts(ctx context.Context, groupids []string) ([]Host, error) {
	params := ZabbixAPIParams{
		"output":    []string{"name", "host"},
		"sortfield": "name",
		"groupids":  groupids,
	}

	result, err := ds.Request(ctx, &ZabbixAPIRequest{Method: "host.get", Params: params})
	if err != nil {
		return nil, err
	}

	var hosts []Host
	err = convertTo(result, &hosts)
	return hosts, err
}

func (ds *Zabbix) GetAllGroups(ctx context.Context) ([]Group, error) {
	params := ZabbixAPIParams{
		"output":     []string{"name"},
		"sortfield":  "name",
		"real_hosts": true,
	}

	result, err := ds.Request(ctx, &ZabbixAPIRequest{Method: "hostgroup.get", Params: params})
	if err != nil {
		return nil, err
	}

	var groups []Group
	err = convertTo(result, &groups)
	return groups, err
}

func isAppMethodNotFoundError(err error) bool {
	if err == nil {
		return false
	}

	message := err.Error()
	return message == `Method not found. Incorrect API "application".`
}
