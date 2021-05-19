package zabbix

import (
	"context"
	"encoding/json"

	"github.com/bitly/go-simplejson"
)

func (ds *Zabbix) GetItems(ctx context.Context, groupFilter string, hostFilter string, appFilter string, itemFilter string, itemType string) (Items, error) {
	hosts, err := ds.GetHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for _, k := range hosts {
		hostids = append(hostids, k["hostid"].(string))
	}

	apps, err := ds.GetApps(ctx, groupFilter, hostFilter, appFilter)
	// Apps not supported in Zabbix 5.4 and higher
	if isAppMethodNotFoundError(err) {
		apps = []map[string]interface{}{}
	} else if err != nil {
		return nil, err
	}
	var appids []string
	for _, l := range apps {
		appids = append(appids, l["applicationid"].(string))
	}

	var allItems *simplejson.Json
	if len(hostids) > 0 {
		allItems, err = ds.GetAllItems(ctx, hostids, nil, itemType)
	} else if len(appids) > 0 {
		allItems, err = ds.GetAllItems(ctx, nil, appids, itemType)
	}

	var items Items

	if allItems == nil {
		items = Items{}
	} else {
		itemsJSON, err := allItems.MarshalJSON()
		if err != nil {
			return nil, err
		}

		err = json.Unmarshal(itemsJSON, &items)
		if err != nil {
			return nil, err
		}
	}

	re, err := parseFilter(itemFilter)
	if err != nil {
		return nil, err
	}

	filteredItems := Items{}
	for _, item := range items {
		itemName := item.ExpandItem()
		if item.Status == "0" {
			if re != nil {
				if re.MatchString(itemName) {
					filteredItems = append(filteredItems, item)
				}
			} else if itemName == itemFilter {
				filteredItems = append(filteredItems, item)
			}
		}
	}
	return filteredItems, nil
}

func (ds *Zabbix) GetApps(ctx context.Context, groupFilter string, hostFilter string, appFilter string) ([]map[string]interface{}, error) {
	hosts, err := ds.GetHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for _, k := range hosts {
		hostids = append(hostids, k["hostid"].(string))
	}
	allApps, err := ds.GetAllApps(ctx, hostids)
	if err != nil {
		return nil, err
	}

	re, err := parseFilter(appFilter)
	if err != nil {
		return nil, err
	}

	var apps []map[string]interface{}
	for _, i := range allApps.MustArray() {
		name := i.(map[string]interface{})["name"].(string)
		if re != nil {
			if re.MatchString(name) {
				apps = append(apps, i.(map[string]interface{}))
			}
		} else if name == appFilter {
			apps = append(apps, i.(map[string]interface{}))
		}
	}
	return apps, nil
}

func (ds *Zabbix) GetHosts(ctx context.Context, groupFilter string, hostFilter string) ([]map[string]interface{}, error) {
	groups, err := ds.GetGroups(ctx, groupFilter)
	if err != nil {
		return nil, err
	}
	var groupids []string
	for _, k := range groups {
		groupids = append(groupids, k["groupid"].(string))
	}
	allHosts, err := ds.GetAllHosts(ctx, groupids)
	if err != nil {
		return nil, err
	}

	re, err := parseFilter(hostFilter)
	if err != nil {
		return nil, err
	}

	var hosts []map[string]interface{}
	for _, i := range allHosts.MustArray() {
		name := i.(map[string]interface{})["name"].(string)
		if re != nil {
			if re.MatchString(name) {
				hosts = append(hosts, i.(map[string]interface{}))
			}
		} else if name == hostFilter {
			hosts = append(hosts, i.(map[string]interface{}))
		}

	}

	return hosts, nil
}

func (ds *Zabbix) GetGroups(ctx context.Context, groupFilter string) ([]map[string]interface{}, error) {
	allGroups, err := ds.GetAllGroups(ctx)
	if err != nil {
		return nil, err
	}
	re, err := parseFilter(groupFilter)
	if err != nil {
		return nil, err
	}

	var groups []map[string]interface{}
	for _, i := range allGroups.MustArray() {
		name := i.(map[string]interface{})["name"].(string)
		if re != nil {
			if re.MatchString(name) {
				groups = append(groups, i.(map[string]interface{}))
			}
		} else if name == groupFilter {
			groups = append(groups, i.(map[string]interface{}))
		}
	}
	return groups, nil
}

func (ds *Zabbix) GetAllItems(ctx context.Context, hostids []string, appids []string, itemtype string) (*simplejson.Json, error) {
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

	return ds.Request(ctx, &ZabbixAPIRequest{Method: "item.get", Params: params})
}

func (ds *Zabbix) GetAllApps(ctx context.Context, hostids []string) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":  "extend",
		"hostids": hostids,
	}

	return ds.Request(ctx, &ZabbixAPIRequest{Method: "application.get", Params: params})
}

func (ds *Zabbix) GetAllHosts(ctx context.Context, groupids []string) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":    []string{"name", "host"},
		"sortfield": "name",
		"groupids":  groupids,
	}

	return ds.Request(ctx, &ZabbixAPIRequest{Method: "host.get", Params: params})
}

func (ds *Zabbix) GetAllGroups(ctx context.Context) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":     []string{"name"},
		"sortfield":  "name",
		"real_hosts": true,
	}

	return ds.Request(ctx, &ZabbixAPIRequest{Method: "hostgroup.get", Params: params})
}

func isAppMethodNotFoundError(err error) bool {
	if err == nil {
		return false
	}

	message := err.Error()
	return message == `Method not found. Incorrect API "application".`
}
