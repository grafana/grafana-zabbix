package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	"golang.org/x/net/context"
)

type FunctionCategories struct {
	Transform []map[string]interface{}
	Aggregate []map[string]interface{}
	Filter    []map[string]interface{}
	Trends    []map[string]interface{}
	Time      []map[string]interface{}
	Alias     []map[string]interface{}
	Special   []map[string]interface{}
}

// ZabbixAPIQuery handles query requests to Zabbix
func (dsInstance *ZabbixDatasourceInstance) ZabbixAPIQuery(ctx context.Context, apiReq *ZabbixAPIRequest) (*ZabbixAPIResourceResponse, error) {
	var result interface{}
	var err error
	var queryExistInCache bool
	result, queryExistInCache = dsInstance.queryCache.Get(HashString(apiReq.String()))

	if !queryExistInCache {
		result, err = dsInstance.ZabbixRequest(ctx, apiReq.Method, apiReq.Params)
		dsInstance.logger.Debug("ZabbixAPIQuery", "result", result)
		dsInstance.queryCache.Set(HashString(apiReq.String()), result)
		if err != nil {
			dsInstance.logger.Debug("ZabbixAPIQuery", "error", err)
			return nil, err
		}
	}

	return BuildAPIResponse(&result)
}

func (ds *ZabbixDatasourceInstance) ZabbixAPIQueryOld(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	result, queryExistInCache := ds.queryCache.Get(HashString(tsdbReq.String()))

	if !queryExistInCache {
		queries := []requestModel{}
		for _, query := range tsdbReq.Queries {
			req := requestModel{}
			err := json.Unmarshal([]byte(query.GetModelJson()), &req)

			if err != nil {
				return nil, err
			}
			queries = append(queries, req)
		}

		if len(queries) == 0 {
			return nil, errors.New("At least one query should be provided")
		}

		query := queries[0].Target
		var err error
		result, err = ds.ZabbixRequest(ctx, query.Method, query.Params)
		ds.queryCache.Set(HashString(tsdbReq.String()), result)
		if err != nil {
			ds.logger.Debug("ZabbixAPIQuery", "error", err)
			return nil, errors.New("ZabbixAPIQuery is not implemented yet")
		}
	}

	return BuildResponse(result)
}

// TestConnection checks authentication and version of the Zabbix API and returns that info
func (ds *ZabbixDatasourceInstance) TestConnection(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	err := ds.loginWithDs(ctx)
	if err != nil {
		return BuildErrorResponse(fmt.Errorf("Authentication failed: %s", err)), nil
	}

	response, err := ds.ZabbixAPIRequest(ctx, "apiinfo.version", ZabbixAPIParams{}, "")
	if err != nil {
		ds.logger.Debug("TestConnection", "error", err)
		return BuildErrorResponse(fmt.Errorf("Version check failed: %s", err)), nil
	}

	resultByte, _ := response.MarshalJSON()
	ds.logger.Debug("TestConnection", "result", string(resultByte))

	testResponse := connectionTestResponse{
		ZabbixVersion: response.MustString(),
	}

	return BuildResponse(testResponse)
}

func (ds *ZabbixDatasourceInstance) queryNumericItems(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	tStart := time.Now()
	jsonQueries := make([]*simplejson.Json, 0)
	for _, query := range tsdbReq.Queries {
		json, err := simplejson.NewJson([]byte(query.ModelJson))
		if err != nil {
			return nil, err
		}

		jsonQueries = append(jsonQueries, json)
	}

	if len(jsonQueries) == 0 {
		return nil, errors.New("At least one query should be provided")
	}

	firstQuery := jsonQueries[0]

	groupFilter := firstQuery.GetPath("group", "filter").MustString()
	hostFilter := firstQuery.GetPath("host", "filter").MustString()
	appFilter := firstQuery.GetPath("application", "filter").MustString()
	itemFilter := firstQuery.GetPath("item", "filter").MustString()

	ds.logger.Debug("queryNumericItems",
		"func", "ds.getItems",
		"groupFilter", groupFilter,
		"hostFilter", hostFilter,
		"appFilter", appFilter,
		"itemFilter", itemFilter)
	items, err := ds.getItems(ctx, tsdbReq.GetDatasource(), groupFilter, hostFilter, appFilter, itemFilter, "num")
	if err != nil {
		return nil, err
	}
	ds.logger.Debug("queryNumericItems", "finished", "ds.getItems", "timeElapsed", time.Now().Sub(tStart))

	metrics, err := ds.queryNumericDataForItems(ctx, tsdbReq, items, jsonQueries, isUseTrend(tsdbReq.GetTimeRange()))
	if err != nil {
		return nil, err
	}
	ds.logger.Debug("queryNumericItems", "finished", "queryNumericDataForItems", "timeElapsed", time.Now().Sub(tStart))

	return BuildMetricsResponse(metrics)
}

func (ds *ZabbixDatasourceInstance) getItems(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupFilter string, hostFilter string, appFilter string, itemFilter string, itemType string) (zabbix.Items, error) {
	tStart := time.Now()

	hosts, err := ds.getHosts(ctx, dsInfo, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for _, k := range hosts {
		hostids = append(hostids, k["hostid"].(string))
	}
	ds.logger.Debug("getItems", "finished", "getHosts", "timeElapsed", time.Now().Sub(tStart))

	apps, err := ds.getApps(ctx, dsInfo, groupFilter, hostFilter, appFilter)
	if err != nil {
		return nil, err
	}
	var appids []string
	for _, l := range apps {
		appids = append(appids, l["applicationid"].(string))
	}
	ds.logger.Debug("getItems", "finished", "getApps", "timeElapsed", time.Now().Sub(tStart))

	var allItems *simplejson.Json
	if len(hostids) > 0 {
		ds.logger.Debug("getAllItems", "with", "hostFilter")
		allItems, err = ds.getAllItems(ctx, dsInfo, hostids, nil, itemType)
	} else if len(appids) > 0 {
		ds.logger.Debug("getAllItems", "with", "appFilter")
		allItems, err = ds.getAllItems(ctx, dsInfo, nil, appids, itemType)
	}
	ds.logger.Debug("getItems", "finished", "getAllItems", "timeElapsed", time.Now().Sub(tStart))

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
		if item.Status == "0" {
			if re != nil {
				if re.MatchString(item.Name) {
					filteredItems = append(filteredItems, item)
				}
			} else if item.Name == itemFilter {
				filteredItems = append(filteredItems, item)
			}
		}
	}
	ds.logger.Debug("getItems", "found", len(items), "matches", len(filteredItems))
	ds.logger.Debug("getItems", "totalTimeTaken", time.Now().Sub(tStart))
	return filteredItems, nil
}

func (ds *ZabbixDatasourceInstance) getApps(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupFilter string, hostFilter string, appFilter string) ([]map[string]interface{}, error) {
	hosts, err := ds.getHosts(ctx, dsInfo, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for _, k := range hosts {
		hostids = append(hostids, k["hostid"].(string))
	}
	allApps, err := ds.getAllApps(ctx, dsInfo, hostids)
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
	ds.logger.Debug("getapps", "found", len(allApps.MustArray()), "matches", len(apps))
	return apps, nil
}

func (ds *ZabbixDatasourceInstance) getHosts(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupFilter string, hostFilter string) ([]map[string]interface{}, error) {
	groups, err := ds.getGroups(ctx, dsInfo, groupFilter)
	if err != nil {
		return nil, err
	}
	var groupids []string
	for _, k := range groups {
		groupids = append(groupids, k["groupid"].(string))
	}
	allHosts, err := ds.getAllHosts(ctx, dsInfo, groupids)
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
	ds.logger.Debug("getHosts", "found", len(allHosts.MustArray()), "matches", len(hosts))
	return hosts, nil
}

func (ds *ZabbixDatasourceInstance) getGroups(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupFilter string) ([]map[string]interface{}, error) {
	allGroups, err := ds.getAllGroups(ctx, dsInfo)
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

func (ds *ZabbixDatasourceInstance) getAllItems(ctx context.Context, dsInfo *datasource.DatasourceInfo, hostids []string, appids []string, itemtype string) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":      &zabbixParamOutput{Fields: []string{"itemid", "name", "key_", "value_type", "hostid", "status", "state"}},
		"sortField":   "name",
		"webItems":    true,
		"filter":      map[string]interface{}{},
		"selectHosts": []string{"hostid", "name"},
		"hostIDs":     hostids,
		"appIDs":      appids,
	}

	filter := params["filter"].(map[string]interface{})
	if itemtype == "num" {
		filter["value_type"] = []int{0, 3}
	} else if itemtype == "text" {
		filter["value_type"] = []int{1, 2, 4}
	}

	return ds.ZabbixRequest(ctx, "item.get", params)
}

func (ds *ZabbixDatasourceInstance) getAllApps(ctx context.Context, dsInfo *datasource.DatasourceInfo, hostids []string) (*simplejson.Json, error) {
	params := ZabbixAPIParams{"output": &zabbixParamOutput{Mode: "extend"}, "hostIDs": hostids}

	return ds.ZabbixRequest(ctx, "application.get", params)
}

func (ds *ZabbixDatasourceInstance) getAllHosts(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupids []string) (*simplejson.Json, error) {
	params := ZabbixAPIParams{"output": &zabbixParamOutput{Fields: []string{"name", "host"}}, "sortField": "name", "groupIDs": groupids}

	return ds.ZabbixRequest(ctx, "host.get", params)
}

func (ds *ZabbixDatasourceInstance) getAllGroups(ctx context.Context, dsInfo *datasource.DatasourceInfo) (*simplejson.Json, error) {
	params := ZabbixAPIParams{"output": &zabbixParamOutput{Fields: []string{"name"}}, "sortField": "name", "realHosts": true}

	return ds.ZabbixRequest(ctx, "hostgroup.get", params)
}

func (ds *ZabbixDatasourceInstance) queryNumericDataForItems(ctx context.Context, tsdbReq *datasource.DatasourceRequest, items zabbix.Items, jsonQueries []*simplejson.Json, useTrend bool) ([]*datasource.TimeSeries, error) {
	valueType := ds.getTrendValueType(jsonQueries)
	consolidateBy := ds.getConsolidateBy(jsonQueries)

	if consolidateBy == "" {
		consolidateBy = valueType
	}

	history, err := ds.getHistotyOrTrend(ctx, tsdbReq, items, useTrend)
	if err != nil {
		return nil, err
	}

	return convertHistory(history, items)
}

func (ds *ZabbixDatasourceInstance) getTrendValueType(jsonQueries []*simplejson.Json) string {
	var trendFunctions []string
	var trendValueFunc string

	// TODO: loop over populated categories
	for _, j := range new(FunctionCategories).Trends {
		trendFunctions = append(trendFunctions, j["name"].(string))
	}
	for _, k := range jsonQueries[0].Get("functions").MustArray() {
		for _, j := range trendFunctions {
			if j == k.(map[string]interface{})["def"].(map[string]interface{})["name"] {
				trendValueFunc = j
			}
		}
	}

	if trendValueFunc == "" {
		trendValueFunc = "avg"
	}

	return trendValueFunc
}

func (ds *ZabbixDatasourceInstance) getConsolidateBy(jsonQueries []*simplejson.Json) string {
	var consolidateBy string

	for _, k := range jsonQueries[0].Get("functions").MustArray() {
		if k.(map[string]interface{})["def"].(map[string]interface{})["name"] == "consolidateBy" {
			defParams := k.(map[string]interface{})["def"].(map[string]interface{})["params"].([]interface{})
			if len(defParams) > 0 {
				consolidateBy = defParams[0].(string)
			}
		}
	}
	return consolidateBy
}

func (ds *ZabbixDatasourceInstance) getHistotyOrTrend(ctx context.Context, tsdbReq *datasource.DatasourceRequest, items zabbix.Items, useTrend bool) (zabbix.History, error) {
	allHistory := zabbix.History{}

	timeRange := tsdbReq.GetTimeRange()
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
			"output":    &zabbixParamOutput{Mode: "extend"},
			"sortField": "clock",
			"sortOrder": "ASC",
			"itemIDs":   itemids,
			"timeFrom":  timeRange.GetFromEpochMs() / 1000,
			"timeTill":  timeRange.GetToEpochMs() / 1000,
		}

		var response *simplejson.Json
		var err error
		if useTrend {
			response, err = ds.ZabbixRequest(ctx, "trend.get", params)
		} else {
			params["history"] = &k
			response, err = ds.ZabbixRequest(ctx, "history.get", params)
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

func isUseTrend(timeRange *datasource.TimeRange) bool {
	fromSec := timeRange.GetFromEpochMs() / 1000
	toSec := timeRange.GetToEpochMs() / 1000
	if (fromSec < time.Now().Add(time.Hour*-7*24).Unix()) ||
		(toSec-fromSec > (4 * 24 * time.Hour).Milliseconds()) {
		return true
	}
	return false
}

func convertHistory(history zabbix.History, items zabbix.Items) ([]*datasource.TimeSeries, error) {
	seriesMap := map[string]*datasource.TimeSeries{}

	for _, item := range items {
		seriesMap[item.ID] = &datasource.TimeSeries{
			Name:   fmt.Sprintf("%s %s", item.Hosts[0].Name, item.Name),
			Points: []*datasource.Point{},
		}
	}

	for _, point := range history {
		seriesMap[point.ItemID].Points = append(seriesMap[point.ItemID].Points, &datasource.Point{
			Timestamp: point.Clock*1000 + int64(math.Round(float64(point.NS)/1000000)),
			Value:     point.Value,
		})
	}

	seriesList := []*datasource.TimeSeries{}
	for _, series := range seriesMap {
		seriesList = append(seriesList, series)
	}
	return seriesList, nil
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
