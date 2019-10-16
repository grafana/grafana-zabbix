package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	"golang.org/x/net/context"
	"golang.org/x/net/context/ctxhttp"
)

var httpClient = &http.Client{
	Transport: &http.Transport{
		TLSClientConfig: &tls.Config{
			Renegotiation: tls.RenegotiateFreelyAsClient,
		},
		Proxy: http.ProxyFromEnvironment,
		Dial: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
			DualStack: true,
		}).Dial,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	},
	Timeout: time.Duration(time.Second * 30),
}

var queryCache = NewCache(10*time.Minute, 10*time.Minute)

var zabbixAuth string = ""

type categories struct {
	Transform []map[string]interface{}
	Aggregate []map[string]interface{}
	Filter    []map[string]interface{}
	Trends    []map[string]interface{}
	Time      []map[string]interface{}
	Alias     []map[string]interface{}
	Special   []map[string]interface{}
}

func (ds *ZabbixDatasource) ZabbixAPIQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	result, queryExistInCache := queryCache.Get(Hash(tsdbReq.String()))

	if !queryExistInCache {
		dsInfo := tsdbReq.GetDatasource()
		zabbixUrlStr := dsInfo.GetUrl()
		zabbixUrl, err := url.Parse(zabbixUrlStr)
		if err != nil {
			return nil, err
		}

		jsonDataStr := dsInfo.GetJsonData()
		jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
		if err != nil {
			return nil, err
		}

		zabbixLogin := jsonData.Get("username").MustString()
		// zabbixPassword := jsonData.Get("password").MustString()
		ds.logger.Debug("ZabbixAPIQuery", "url", zabbixUrl, "user", zabbixLogin)

		jsonQueries := make([]*simplejson.Json, 0)
		for _, query := range tsdbReq.Queries {
			json, err := simplejson.NewJson([]byte(query.ModelJson))
			apiMethod := json.GetPath("target", "method").MustString()
			apiParams := json.GetPath("target", "params")

			if err != nil {
				return nil, err
			}

			ds.logger.Debug("ZabbixAPIQuery", "method", apiMethod, "params", apiParams)

			jsonQueries = append(jsonQueries, json)
		}

		if len(jsonQueries) == 0 {
			return nil, errors.New("At least one query should be provided")
		}

		jsonQuery := jsonQueries[0].Get("target")
		apiMethod := jsonQuery.Get("method").MustString()
		apiParams := jsonQuery.Get("params")

		result, err = ds.ZabbixRequest(ctx, dsInfo, apiMethod, apiParams)
		queryCache.Set(Hash(tsdbReq.String()), result)
		if err != nil {
			ds.logger.Debug("ZabbixAPIQuery", "error", err)
			return nil, errors.New("ZabbixAPIQuery is not implemented yet")
		}
	}

	resultByte, _ := result.(*simplejson.Json).MarshalJSON()
	ds.logger.Debug("ZabbixAPIQuery", "result", string(resultByte))

	return ds.BuildResponse(result.(*simplejson.Json))
}

func (ds *ZabbixDatasource) BuildResponse(result *simplejson.Json) (*datasource.DatasourceResponse, error) {
	resultByte, err := result.MarshalJSON()
	if err != nil {
		return nil, err
	}

	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId:    "zabbixAPI",
				MetaJson: string(resultByte),
			},
		},
	}, nil
}

func (ds *ZabbixDatasource) ZabbixRequest(ctx context.Context, dsInfo *datasource.DatasourceInfo, method string, params *simplejson.Json) (*simplejson.Json, error) {
	zabbixUrl := dsInfo.GetUrl()

	// Authenticate first
	if zabbixAuth == "" {
		auth, err := ds.loginWithDs(ctx, dsInfo)
		if err != nil {
			return nil, err
		}
		zabbixAuth = auth
	}

	return ds.zabbixAPIRequest(ctx, zabbixUrl, method, params, zabbixAuth)
}

func (ds *ZabbixDatasource) loginWithDs(ctx context.Context, dsInfo *datasource.DatasourceInfo) (string, error) {
	zabbixUrlStr := dsInfo.GetUrl()
	zabbixUrl, err := url.Parse(zabbixUrlStr)
	if err != nil {
		return "", err
	}

	jsonDataStr := dsInfo.GetJsonData()
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return "", err
	}

	zabbixLogin := jsonData.Get("username").MustString()
	zabbixPassword := jsonData.Get("password").MustString()
	auth, err := ds.login(ctx, zabbixUrlStr, zabbixLogin, zabbixPassword)
	if err != nil {
		ds.logger.Error("loginWithDs", "error", err)
		return "", err
	}
	ds.logger.Debug("loginWithDs", "url", zabbixUrl, "user", zabbixLogin, "auth", auth)

	return auth, nil
}

func (ds *ZabbixDatasource) login(ctx context.Context, apiUrl string, username string, password string) (string, error) {
	params := map[string]interface{}{
		"user":     username,
		"password": password,
	}
	paramsJson, err := json.Marshal(params)
	if err != nil {
		return "", err
	}
	data, _ := simplejson.NewJson(paramsJson)
	auth, err := ds.zabbixAPIRequest(ctx, apiUrl, "user.login", data, "")
	if err != nil {
		return "", err
	}

	return auth.MustString(), nil
}

func (ds *ZabbixDatasource) zabbixAPIRequest(ctx context.Context, apiUrl string, method string, params *simplejson.Json, auth string) (*simplejson.Json, error) {
	zabbixUrl, err := url.Parse(apiUrl)

	// TODO: inject auth token (obtain from 'user.login' first)
	apiRequest := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  method,
		"params":  params,
	}

	if auth != "" {
		apiRequest["auth"] = auth
	}

	reqBodyJson, err := json.Marshal(apiRequest)
	if err != nil {
		return nil, err
	}

	var body io.Reader
	body = bytes.NewReader(reqBodyJson)
	rc, ok := body.(io.ReadCloser)
	if !ok && body != nil {
		rc = ioutil.NopCloser(body)
	}

	req := &http.Request{
		Method: "POST",
		URL:    zabbixUrl,
		Header: map[string][]string{
			"Content-Type": {"application/json"},
		},
		Body: rc,
	}

	response, err := makeHttpRequest(ctx, req)
	if err != nil {
		return nil, err
	}

	ds.logger.Debug("zabbixAPIRequest", "response", string(response))

	return handleApiResult(response)
}

func handleApiResult(response []byte) (*simplejson.Json, error) {
	jsonResp, err := simplejson.NewJson([]byte(response))
	if err != nil {
		return nil, err
	}
	if errJson, isError := jsonResp.CheckGet("error"); isError {
		errMessage := fmt.Sprintf("%s %s", errJson.Get("message").MustString(), errJson.Get("data").MustString())
		return nil, errors.New(errMessage)
	}
	jsonResult := jsonResp.Get("result")
	return jsonResult, nil
}

func makeHttpRequest(ctx context.Context, req *http.Request) ([]byte, error) {
	res, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid status code. status: %v", res.Status)
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}

func (ds *ZabbixDatasource) queryNumericItems(ctx context.Context, tsdbReq *datasource.DatasourceRequest) error {
	jsonQueries := make([]*simplejson.Json, 0)
	for _, query := range tsdbReq.Queries {
		json, err := simplejson.NewJson([]byte(query.ModelJson))
		if err != nil {
			return err
		}

		jsonQueries = append(jsonQueries, json)
	}

	if len(jsonQueries) == 0 {
		return errors.New("At least one query should be provided")
	}

	jsonQuery := jsonQueries[0].Get("target")
	groupFilter := jsonQuery.GetPath("group", "filter").MustString()
	hostFilter := jsonQuery.GetPath("host", "filter").MustString()
	appFilter := jsonQuery.GetPath("application", "filter").MustString()
	itemFilter := jsonQuery.GetPath("item", "filter").MustString()

	items, err := ds.getItems(ctx, tsdbReq.GetDatasource(), groupFilter, hostFilter, appFilter, itemFilter, "num")

	response, err := ds.queryNumericDataForItems(ctx, tsdbReq, items, jsonQueries, isUseTrend(tsdbReq.GetTimeRange()))

	ds.logger.Info("queryNumericItems response", response)
	return err
}

func (ds *ZabbixDatasource) getItems(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupFilter string, hostFilter string, appFilter string, itemFilter string, itemType string) ([]*simplejson.Json, error) {
	hosts, err := ds.getHosts(ctx, dsInfo, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for i := range hosts {
		hostids = append(hostids, hosts[i].Get("hostid").MustString())
	}

	apps, err := ds.getApps(ctx, dsInfo, groupFilter, hostFilter, appFilter)
	if err != nil {
		return nil, err
	}
	var appids []string
	for i := range apps {
		appids = append(appids, apps[i].Get("applicationid").MustString())
	}

	var allItems *simplejson.Json
	if len(hostids) > 0 {
		allItems, err = ds.getAllItems(ctx, dsInfo, hostids, nil, itemType)
	} else if len(appids) > 0 {
		allItems, err = ds.getAllItems(ctx, dsInfo, nil, appids, itemType)
	}

	if err != nil {
		return nil, err
	}
	var items []*simplejson.Json
	for k := range allItems.Get("result").MustArray() {
		if allItems.Get("result").Get("status").MustString() == "0" {
			matched, err := regexp.MatchString(itemFilter, allItems.Get("result").GetIndex(k).MustString())
			if err != nil {
				return nil, err
			} else if matched {
				items = append(items, allItems.Get("result").GetIndex(k))
			}
		}
	}
	return items, nil
}

func (ds *ZabbixDatasource) getApps(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupFilter string, hostFilter string, appFilter string) ([]*simplejson.Json, error) {
	hosts, err := ds.getHosts(ctx, dsInfo, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for i := range hosts {
		hostids = append(hostids, hosts[i].Get("hostid").MustString())
	}
	allApps, err := ds.getAllApps(ctx, dsInfo, hostids)
	if err != nil {
		return nil, err
	}
	var apps []*simplejson.Json
	for k := range allApps.Get("result").MustArray() {
		matched, err := regexp.MatchString(appFilter, allApps.Get("result").GetIndex(k).MustString())
		if err != nil {
			return nil, err
		} else if matched {
			apps = append(apps, allApps.Get("result").GetIndex(k))
		}
	}
	return apps, nil
}

func (ds *ZabbixDatasource) getHosts(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupFilter string, hostFilter string) ([]*simplejson.Json, error) {
	groups, err := ds.getGroups(ctx, dsInfo, groupFilter)
	if err != nil {
		return nil, err
	}
	var groupids []string
	for i := range groups {
		groupids = append(groupids, groups[i].Get("groupid").MustString())
	}
	allHosts, err := ds.getAllHosts(ctx, dsInfo, groupids)
	if err != nil {
		return nil, err
	}
	var hosts []*simplejson.Json
	for k := range allHosts.Get("result").MustArray() {
		matched, err := regexp.MatchString(hostFilter, allHosts.Get("result").GetIndex(k).MustString())
		if err != nil {
			return nil, err
		} else if matched {
			hosts = append(hosts, allHosts.Get("result").GetIndex(k))
		}
	}
	return hosts, nil
}

func (ds *ZabbixDatasource) getGroups(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupFilter string) ([]*simplejson.Json, error) {
	allGroups, err := ds.getAllGroups(ctx, dsInfo)
	if err != nil {
		return nil, err
	}
	var groups []*simplejson.Json
	for k := range allGroups.Get("result").MustArray() {
		matched, err := regexp.MatchString(groupFilter, allGroups.Get("result").GetIndex(k).MustString())
		if err != nil {
			return nil, err
		} else if matched {
			groups = append(groups, allGroups.Get("result").GetIndex(k))
		}
	}
	return groups, nil
}

func (ds *ZabbixDatasource) getAllItems(ctx context.Context, dsInfo *datasource.DatasourceInfo, hostids []string, appids []string, itemtype string) (*simplejson.Json, error) {
	params, err := simplejson.NewJson([]byte(`{"output":["name", "key_", "value_type", "hostid", "status", "state"], "sortfield": "name", "webitems": true, "filter": {}, "selectHosts": ["hostid", "name"]}`))
	if err != nil {
		return nil, err
	} else if itemtype == "num" {
		params.SetPath([]string{"filter", "value_type"}, []int{0, 3})
	} else if itemtype == "text" {
		params.SetPath([]string{"filter", "value_type"}, []int{1, 2, 4})
	}

	if len(hostids) > 0 {
		params.Set("hostids", hostids)
	}

	if len(appids) > 0 {
		params.Set("applicationids", appids)
	}

	return ds.ZabbixRequest(ctx, dsInfo, "item.get", params)
}

func (ds *ZabbixDatasource) getAllApps(ctx context.Context, dsInfo *datasource.DatasourceInfo, hostids []string) (*simplejson.Json, error) {
	params, err := simplejson.NewJson([]byte(`{"output":"extend"}`))
	if err != nil {
		return nil, err
	} else if len(hostids) > 0 {
		params.Set("hostids", hostids)
	}

	return ds.ZabbixRequest(ctx, dsInfo, "application.get", params)
}

func (ds *ZabbixDatasource) getAllHosts(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupids []string) (*simplejson.Json, error) {
	params, err := simplejson.NewJson([]byte(`{"output":["name","host"],"sortfield":"name"}`))
	if err != nil {
		return nil, err
	} else if len(groupids) > 0 {
		params.Set("groupids", groupids)
	}

	return ds.ZabbixRequest(ctx, dsInfo, "host.get", params)
}

func (ds *ZabbixDatasource) getAllGroups(ctx context.Context, dsInfo *datasource.DatasourceInfo) (*simplejson.Json, error) {
	params, err := simplejson.NewJson([]byte(`{"output":["name"],"sortfield":"name","real_hosts":true}`))
	if err != nil {
		return nil, err
	}
	return ds.ZabbixRequest(ctx, dsInfo, "hostgroup.get", params)
}
func (ds *ZabbixDatasource) queryNumericDataForItems(ctx context.Context, tsdbReq *datasource.DatasourceRequest, items []*simplejson.Json, jsonQueries []*simplejson.Json, useTrend bool) ([]*simplejson.Json, error) {
	valueType := ds.getTrendValueType(jsonQueries)
	var consolidateBy string
	if ds.getConsolidateBy(jsonQueries) != "" {
		consolidateBy = ds.getConsolidateBy(jsonQueries)
	} else {
		consolidateBy = valueType
	}
	ds.logger.Info(consolidateBy)

	return ds.getHistotyOrTrend(ctx, tsdbReq, items, useTrend)
	// Todo: convert the response
}
func (ds *ZabbixDatasource) getTrendValueType(jsonQueries []*simplejson.Json) string {
	var trendFunctions []string
	var trendValueFunc string

	// loop over actual returned categories
	for _, j := range new(categories).Trends {
		trendFunctions = append(trendFunctions, j["name"].(string))
	}

	for i := range jsonQueries[0].Get("target").MustArray() {
		for _, j := range trendFunctions {
			if j == jsonQueries[0].Get("target").GetIndex(i).GetPath("function", "def", "name").MustString() {
				trendValueFunc = j
			}
		}
	}

	if trendValueFunc == "" {
		trendValueFunc = "avg"
	}

	return trendValueFunc
}

func (ds *ZabbixDatasource) getConsolidateBy(jsonQueries []*simplejson.Json) string {
	var consolidateBy []string
	for i, j := range jsonQueries[0].Get("target").MustArray() {
		if jsonQueries[0].Get("target").GetIndex(i).GetPath("function", "def", "name").MustString() == "consolidateBy" {
			consolidateBy = append(consolidateBy, j.(string))
		}
	}
	return consolidateBy[0]
}

func (ds *ZabbixDatasource) getHistotyOrTrend(ctx context.Context, tsdbReq *datasource.DatasourceRequest, items []*simplejson.Json, useTrend bool) ([]*simplejson.Json, error) {
	var result []*simplejson.Json
	var response *simplejson.Json
	timeRange := tsdbReq.GetTimeRange()
	groupedItems := map[string][]*simplejson.Json{}

	for _, j := range items {
		groupedItems[j.Get("value_type").MustString()] = append(groupedItems[j.Get("value_type").MustString()], j)
	}

	for k, l := range groupedItems {
		var itemids []string
		for _, m := range l {
			itemids = append(itemids, m.Get("itemid").MustString())
		}
		params, err := simplejson.NewJson([]byte(`{"output":"extend", "sortfield": "clock", "sortorder": "ASC"}`))
		if err != nil {
			return nil, err
		}
		params.Set("history", k)
		params.Set("itemids", itemids)
		params.Set("time_from", timeRange.GetFromRaw)

		if timeRange.GetToRaw() != "" {
			params.Set("time_till", timeRange.GetToRaw())
		}

		if useTrend {
			response, err = ds.ZabbixRequest(ctx, tsdbReq.GetDatasource(), "trend.get", params)
		} else {
			response, err = ds.ZabbixRequest(ctx, tsdbReq.GetDatasource(), "history.get", params)
		}

		if err != nil {
			return nil, err
		}
		result = append(result, response)
	}
	return result, nil
}

func isUseTrend(timeRange *datasource.TimeRange) bool {
	if (timeRange.GetFromEpochMs() < 7*24*time.Hour.Nanoseconds()/1000000) ||
		(timeRange.GetFromEpochMs()-timeRange.GetToEpochMs() > 4*24*time.Hour.Nanoseconds()/1000000) {
		return true
	}
	return false
}
