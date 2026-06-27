package zabbix

import (
	"context"
	"sort"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (ds *Zabbix) GetHistory(ctx context.Context, items []*Item, timeRange backend.TimeRange) (History, error) {
	history := History{}
	// Zabbix stores history in different tables and `history` param required for query. So in one query it's only
	// possible to get history for items with one type. In order to get history for items with multiple types (numeric unsigned and numeric float),
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

func (ds *Zabbix) GetItems(
	ctx context.Context,
	groupFilter string,
	hostFilter string,
	itemTagFilter string,
	itemFilter string,
	itemType string,
	showDisabled bool,
) ([]*Item, error) {
	var allItems []*Item
	hosts, err := ds.GetHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	if len(hosts) == 0 {
		return allItems, nil
	}

	hostids := make([]string, 0)
	for _, host := range hosts {
		hostids = append(hostids, host.ID)
	}

	if isRegex(itemTagFilter) {
		ds.logger.Debug("Processing regex item tag filter", "filterPattern", itemTagFilter, "hostCount", len(hostids))
		tags, err := ds.GetItemTags(ctx, groupFilter, hostFilter, itemTagFilter)
		if err != nil {
			return nil, err
		}
		ds.logger.Debug("GetItemTags completed", "matchedTagCount", len(tags), "filterPattern", itemTagFilter)
		// If regex filter doesn't match any tags, return empty items list
		// to prevent silently removing the filter and returning all items
		if len(tags) == 0 {
			return []*Item{}, nil
		}
		var tagStrs []string
		for _, t := range tags {
			tagStrs = append(tagStrs, itemTagToString(t))
		}
		itemTagFilter = strings.Join(tagStrs, ",")
	}
	ds.logger.Debug("Fetching items with filters", "hostCount", len(hostids), "itemType", itemType, "showDisabled", showDisabled, "hasItemTagFilter", len(itemTagFilter) > 0)
	allItems, err = ds.GetAllItems(ctx, hostids, nil, itemType, showDisabled, itemTagFilter)
	if err != nil {
		return nil, err
	}

	return filterItemsByQuery(allItems, itemFilter)
}

func (ds *Zabbix) GetItemsBefore54(
	ctx context.Context,
	groupFilter string,
	hostFilter string,
	appFilter string,
	itemFilter string,
	itemType string,
	showDisabled bool,
) ([]*Item, error) {
	hosts, err := ds.GetHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	hostids := make([]string, 0)
	for _, host := range hosts {
		hostids = append(hostids, host.ID)
	}

	apps, err := ds.GetApps(ctx, groupFilter, hostFilter, appFilter)
	if err != nil {
		return nil, err
	}

	appids := make([]string, 0)
	for _, app := range apps {
		appids = append(appids, app.ID)
	}

	var allItems []*Item
	if len(appids) > 0 {
		allItems, err = ds.GetAllItems(ctx, nil, appids, itemType, showDisabled, "")
	} else if appFilter == "" && len(hostids) > 0 {
		allItems, err = ds.GetAllItems(ctx, hostids, nil, itemType, showDisabled, "")
	}
	if err != nil {
		return nil, err
	}

	return filterItemsByQuery(allItems, itemFilter)
}

func filterItemsByQuery(items []*Item, filter string) ([]*Item, error) {
	re, err := parseFilter(filter)
	if err != nil {
		return nil, err
	}

	filteredItems := make([]*Item, 0)
	for _, i := range items {
		name := i.Name
		if re != nil {
			match, err := re.MatchString(name)
			if err != nil {
				return nil, err
			}
			if match {
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
	hostids := make([]string, 0)
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

	filteredItems := make([]Application, 0)
	for _, i := range items {
		name := i.Name
		if re != nil {
			match, err := re.MatchString(name)
			if err != nil {
				return nil, err
			}
			if match {
				filteredItems = append(filteredItems, i)
			}
		} else if name == filter {
			filteredItems = append(filteredItems, i)
		}

	}

	return filteredItems, nil
}

func (ds *Zabbix) GetItemTags(ctx context.Context, groupFilter string, hostFilter string, tagFilter string) ([]Tag, error) {
	hosts, err := ds.GetHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	hostids := make([]string, 0)
	for _, host := range hosts {
		hostids = append(hostids, host.ID)
	}

	var allItems []*Item
	itemType := "num"
	showDisabled := false

	allItems, err = ds.GetAllItems(ctx, hostids, nil, itemType, showDisabled, "")
	if err != nil {
		return nil, err
	}

	var allTags []Tag
	tagsMap := make(map[string]Tag)
	for _, item := range allItems {
		for _, itemTag := range item.Tags {
			tagStr := itemTagToString(itemTag)
			tagsMap[tagStr] = itemTag
		}
	}
	for _, t := range tagsMap {
		allTags = append(allTags, t)
	}

	return filterTags(allTags, tagFilter)
}

func filterTags(items []Tag, filter string) ([]Tag, error) {
	re, err := parseFilter(filter)
	if err != nil {
		return nil, err
	}

	filteredItems := make([]Tag, 0)
	for _, i := range items {
		tagStr := itemTagToString(i)
		if re != nil {
			match, err := re.MatchString(tagStr)
			if err != nil {
				return nil, err
			}
			if match {
				filteredItems = append(filteredItems, i)
			}
		} else if tagStr == filter {
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
	groupids := make([]string, 0)
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

	filteredItems := make([]Host, 0)
	for _, i := range items {
		name := i.Name
		if re != nil {
			match, err := re.MatchString(name)
			if err != nil {
				return nil, err
			}
			if match {
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

	filteredItems := make([]Group, 0)
	for _, i := range items {
		name := i.Name
		if re != nil {
			match, err := re.MatchString(name)
			if err != nil {
				return nil, err
			}
			if match {
				filteredItems = append(filteredItems, i)
			}
		} else if name == filter {
			filteredItems = append(filteredItems, i)
		}

	}

	return filteredItems, nil
}

func (ds *Zabbix) GetAllItems(ctx context.Context, hostids []string, appids []string, itemtype string, showDisabled bool, itemTagFilter string) ([]*Item, error) {
	params := ZabbixAPIParams{
		"output":         []string{"itemid", "name", "key_", "value_type", "hostid", "status", "state", "units", "valuemapid", "delay"},
		"sortfield":      "name",
		"webitems":       true,
		"filter":         map[string]interface{}{},
		"selectHosts":    []string{"hostid", "name"},
		"hostids":        hostids,
		"applicationids": appids,
	}

	filter := params["filter"].(map[string]interface{})
	switch itemtype {
	case "num":
		filter["value_type"] = []int{0, 3}
	case "text":
		filter["value_type"] = []int{1, 2, 4}
	}

	if ds.version >= 54 {
		params["selectTags"] = "extend"
		if len(itemTagFilter) > 0 {
			allTags := strings.Split(itemTagFilter, ",")
			tagsParams := make([]map[string]string, 0)
			for _, tagStr := range allTags {
				tag := parseItemTag(tagStr)
				tagParam := map[string]string{
					"tag":      tag.Tag,
					"value":    tag.Value,
					"operator": "1",
				}
				tagsParams = append(tagsParams, tagParam)
			}
			// tags order should be handled for higher cache hit ratio
			sort.Slice(tagsParams, func(i, j int) bool {
				if tagsParams[i]["tag"] != tagsParams[j]["tag"] {
					return tagsParams[i]["tag"] < tagsParams[j]["tag"]
				}
				return tagsParams[i]["value"] < tagsParams[j]["value"]
			})
			params["tags"] = tagsParams
			params["evaltype"] = 2
		}
	}

	if !showDisabled {
		params["monitored"] = true
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

func (ds *Zabbix) GetItemsByIDs(ctx context.Context, itemids []string) ([]*Item, error) {
	params := ZabbixAPIParams{
		"itemids":     itemids,
		"output":      []string{"itemid", "name", "key_", "value_type", "hostid", "status", "state", "units", "valuemapid", "delay"},
		"webitems":    true,
		"selectHosts": []string{"hostid", "name"},
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
		"output":    []string{"hostid", "name", "host"},
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
		"output":     []string{"name", "groupid"},
		"sortfield":  "name",
		"with_hosts": true,
	}

	result, err := ds.Request(ctx, &ZabbixAPIRequest{Method: "hostgroup.get", Params: params})
	if err != nil {
		return nil, err
	}

	var groups []Group
	err = convertTo(result, &groups)
	return groups, err
}

func (ds *Zabbix) GetValueMappings(ctx context.Context) ([]ValueMap, error) {
	params := ZabbixAPIParams{
		"output":         "extend",
		"selectMappings": "extend",
	}

	result, err := ds.Request(ctx, &ZabbixAPIRequest{Method: "valuemap.get", Params: params})
	if err != nil {
		return nil, err
	}

	var valuemaps []ValueMap
	err = convertTo(result, &valuemaps)
	return valuemaps, err
}

func (ds *Zabbix) GetFullVersion(ctx context.Context) (string, error) {
	result, err := ds.request(ctx, "apiinfo.version", ZabbixAPIParams{})
	if err != nil {
		return "", err
	}

	var version string
	err = convertTo(result, &version)
	if err != nil {
		return "", err
	}
	
	return version, nil
}

func (ds *Zabbix) GetVersion(ctx context.Context) (int, error) {
	fullStringVersion, err := ds.GetFullVersion(ctx)
	if err != nil {
		return 0, err
	}

	version := strings.Replace(fullStringVersion[0:3], ".", "", 1)
	versionNum, err := strconv.Atoi(version)
	return versionNum, err
}
