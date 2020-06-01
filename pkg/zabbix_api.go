package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"golang.org/x/net/context"
)

var NotCachedMethods = map[string]bool{
	"history.get": true,
	"trend.get":   true,
}

// ZabbixQuery handles query requests to Zabbix
func (ds *ZabbixDatasourceInstance) ZabbixQuery(ctx context.Context, apiReq *ZabbixAPIRequest) (*simplejson.Json, error) {
	var resultJson *simplejson.Json
	var err error
	requestHash := HashString(apiReq.String())

	cachedResult, queryExistInCache := ds.queryCache.Get(requestHash)
	if !queryExistInCache {
		resultJson, err = ds.ZabbixRequest(ctx, apiReq.Method, apiReq.Params)

		if _, ok := NotCachedMethods[apiReq.Method]; !ok {
			ds.logger.Debug("Write result to cache", "method", apiReq.Method)
			ds.queryCache.Set(requestHash, resultJson)
		}
		if err != nil {
			return nil, err
		}
	} else {
		resultJson = cachedResult.(*simplejson.Json)
	}

	return resultJson, nil
}

// ZabbixAPIQuery handles query requests to Zabbix
func (ds *ZabbixDatasourceInstance) ZabbixAPIQuery(ctx context.Context, apiReq *ZabbixAPIRequest) (*ZabbixAPIResourceResponse, error) {
	resultJson, err := ds.ZabbixQuery(ctx, apiReq)
	if err != nil {
		return nil, err
	}
	result := resultJson.Interface()
	return BuildAPIResponse(&result)
}

// TestConnection checks authentication and version of the Zabbix API and returns that info
func (ds *ZabbixDatasourceInstance) TestConnection(ctx context.Context) (string, error) {
	_, err := ds.getAllGroups(ctx)
	if err != nil {
		return "", err
	}

	response, err := ds.ZabbixAPIRequest(ctx, "apiinfo.version", ZabbixAPIParams{}, "")
	if err != nil {
		return "", err
	}

	resultByte, _ := response.MarshalJSON()
	ds.logger.Debug("TestConnection", "result", string(resultByte))

	return string(resultByte), nil
}

func (ds *ZabbixDatasourceInstance) queryNumericItems(ctx context.Context, query *QueryModel) (*data.Frame, error) {
	groupFilter := query.Group.Filter
	hostFilter := query.Host.Filter
	appFilter := query.Application.Filter
	itemFilter := query.Item.Filter

	items, err := ds.getItems(ctx, groupFilter, hostFilter, appFilter, itemFilter, "num")
	if err != nil {
		return nil, err
	}

	frames, err := ds.queryNumericDataForItems(ctx, query, items)
	if err != nil {
		return nil, err
	}

	return frames, nil
}

func (ds *ZabbixDatasourceInstance) getItems(ctx context.Context, groupFilter string, hostFilter string, appFilter string, itemFilter string, itemType string) (zabbix.Items, error) {
	hosts, err := ds.getHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for _, k := range hosts {
		hostids = append(hostids, k["hostid"].(string))
	}

	apps, err := ds.getApps(ctx, groupFilter, hostFilter, appFilter)
	if err != nil {
		return nil, err
	}
	var appids []string
	for _, l := range apps {
		appids = append(appids, l["applicationid"].(string))
	}

	var allItems *simplejson.Json
	if len(hostids) > 0 {
		allItems, err = ds.getAllItems(ctx, hostids, nil, itemType)
	} else if len(appids) > 0 {
		allItems, err = ds.getAllItems(ctx, nil, appids, itemType)
	}

	var items zabbix.Items

	if allItems == nil {
		items = zabbix.Items{}
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

	filteredItems := zabbix.Items{}
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

func (ds *ZabbixDatasourceInstance) getApps(ctx context.Context, groupFilter string, hostFilter string, appFilter string) ([]map[string]interface{}, error) {
	hosts, err := ds.getHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for _, k := range hosts {
		hostids = append(hostids, k["hostid"].(string))
	}
	allApps, err := ds.getAllApps(ctx, hostids)
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

func (ds *ZabbixDatasourceInstance) getHosts(ctx context.Context, groupFilter string, hostFilter string) ([]map[string]interface{}, error) {
	groups, err := ds.getGroups(ctx, groupFilter)
	if err != nil {
		return nil, err
	}
	var groupids []string
	for _, k := range groups {
		groupids = append(groupids, k["groupid"].(string))
	}
	allHosts, err := ds.getAllHosts(ctx, groupids)
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

func (ds *ZabbixDatasourceInstance) getGroups(ctx context.Context, groupFilter string) ([]map[string]interface{}, error) {
	allGroups, err := ds.getAllGroups(ctx)
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

func (ds *ZabbixDatasourceInstance) getAllItems(ctx context.Context, hostids []string, appids []string, itemtype string) (*simplejson.Json, error) {
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

	return ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "item.get", Params: params})
}

func (ds *ZabbixDatasourceInstance) getAllApps(ctx context.Context, hostids []string) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":  "extend",
		"hostids": hostids,
	}

	return ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "application.get", Params: params})
}

func (ds *ZabbixDatasourceInstance) getAllHosts(ctx context.Context, groupids []string) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":    []string{"name", "host"},
		"sortfield": "name",
		"groupids":  groupids,
	}

	return ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "host.get", Params: params})
}

func (ds *ZabbixDatasourceInstance) getAllGroups(ctx context.Context) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":     []string{"name"},
		"sortfield":  "name",
		"real_hosts": true,
	}

	return ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "hostgroup.get", Params: params})
}

func (ds *ZabbixDatasourceInstance) queryNumericDataForItems(ctx context.Context, query *QueryModel, items zabbix.Items) (*data.Frame, error) {
	valueType := ds.getTrendValueType(query)
	consolidateBy := ds.getConsolidateBy(query)

	if consolidateBy == "" {
		consolidateBy = valueType
	}

	history, err := ds.getHistotyOrTrend(ctx, query, items)
	if err != nil {
		return nil, err
	}

	return convertHistory(history, items), nil
}

func (ds *ZabbixDatasourceInstance) getTrendValueType(query *QueryModel) string {
	trendValue := "avg"

	for _, fn := range query.Functions {
		if fn.Def.Name == "trendValue" && len(fn.Params) > 0 {
			trendValue = fn.Params[0]
		}
	}

	return trendValue
}

func (ds *ZabbixDatasourceInstance) getConsolidateBy(query *QueryModel) string {
	consolidateBy := "avg"

	for _, fn := range query.Functions {
		if fn.Def.Name == "consolidateBy" && len(fn.Params) > 0 {
			consolidateBy = fn.Params[0]
		}
	}
	return consolidateBy
}

func (ds *ZabbixDatasourceInstance) getHistotyOrTrend(ctx context.Context, query *QueryModel, items zabbix.Items) (zabbix.History, error) {
	timeRange := query.TimeRange
	useTrend := ds.isUseTrend(timeRange)
	allHistory := zabbix.History{}

	groupedItems := map[int]zabbix.Items{}

	for _, j := range items {
		groupedItems[j.ValueType] = append(groupedItems[j.ValueType], j)
	}

	for k, l := range groupedItems {
		var itemids []string
		for _, m := range l {
			itemids = append(itemids, m.ID)
		}

		params := ZabbixAPIParams{
			"output":    "extend",
			"sortfield": "clock",
			"sortorder": "ASC",
			"itemids":   itemids,
			"time_from": timeRange.From.Unix(),
			"time_till": timeRange.To.Unix(),
		}

		var response *simplejson.Json
		var err error
		if useTrend {
			response, err = ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "trend.get", Params: params})
		} else {
			params["history"] = &k
			response, err = ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "history.get", Params: params})
		}

		if err != nil {
			return nil, err
		}

		pointJSON, err := response.MarshalJSON()
		if err != nil {
			return nil, fmt.Errorf("Internal error parsing response JSON: %w", err)
		}

		history := zabbix.History{}
		err = json.Unmarshal(pointJSON, &history)
		if err != nil {
			ds.logger.Warn(fmt.Sprintf("Could not map Zabbix response to History: %s", err.Error()))
		} else {
			allHistory = append(allHistory, history...)
		}
	}
	return allHistory, nil
}

func (ds *ZabbixDatasourceInstance) isUseTrend(timeRange backend.TimeRange) bool {
	if !ds.Settings.Trends {
		return false
	}

	trendsFrom := ds.Settings.TrendsFrom
	trendsRange := ds.Settings.TrendsRange
	fromSec := timeRange.From.Unix()
	toSec := timeRange.To.Unix()
	rangeSec := float64(toSec - fromSec)

	if (fromSec < time.Now().Add(-trendsFrom).Unix()) || (rangeSec > trendsRange.Seconds()) {
		return true
	}
	return false
}

func convertHistory(history zabbix.History, items zabbix.Items) *data.Frame {
	timeFileld := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeFileld.Name = "time"
	frame := data.NewFrame("History", timeFileld)

	for _, item := range items {
		field := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)
		if len(item.Hosts) > 0 {
			field.Name = fmt.Sprintf("%s: %s", item.Hosts[0].Name, item.ExpandItem())
		} else {
			field.Name = item.ExpandItem()
		}
		frame.Fields = append(frame.Fields, field)
	}

	for _, point := range history {
		for columnIndex, field := range frame.Fields {
			if columnIndex == 0 {
				ts := time.Unix(point.Clock, point.NS)
				field.Append(ts)
			} else {
				item := items[columnIndex-1]
				if point.ItemID == item.ID {
					value := point.Value
					field.Append(&value)
				} else {
					field.Append(nil)
				}
			}
		}
	}

	// TODO: convert to wide format
	wideFrame, err := data.LongToWide(frame, &data.FillMissing{Mode: data.FillModeNull})
	if err == nil {
		return wideFrame
	}
	return frame
}

func parseFilter(filter string) (*regexp.Regexp, error) {
	regex := regexp.MustCompile(`^/(.+)/(.*)$`)
	flagRE := regexp.MustCompile("[imsU]+")

	matches := regex.FindStringSubmatch(filter)
	if len(matches) <= 1 {
		return nil, nil
	}

	pattern := ""
	if matches[2] != "" {
		if flagRE.MatchString(matches[2]) {
			pattern += "(?" + matches[2] + ")"
		} else {
			return nil, fmt.Errorf("error parsing regexp: unsupported flags `%s` (expected [imsU])", matches[2])
		}
	}
	pattern += matches[1]

	return regexp.Compile(pattern)
}
