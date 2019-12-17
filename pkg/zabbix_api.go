package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	"golang.org/x/net/context"
	"golang.org/x/net/context/ctxhttp"
)

// ZabbixDatasource stores state about a specific datasource and provides methods to make
// requests to the Zabbix API
type ZabbixDatasource struct {
	queryCache *Cache
	logger     hclog.Logger
	httpClient *http.Client
	authToken  string
}

type categories struct {
	Transform []map[string]interface{}
	Aggregate []map[string]interface{}
	Filter    []map[string]interface{}
	Trends    []map[string]interface{}
	Time      []map[string]interface{}
	Alias     []map[string]interface{}
	Special   []map[string]interface{}
}

// NewZabbixDatasource returns an initialized ZabbixDatasource
func NewZabbixDatasource() *ZabbixDatasource {
	return &ZabbixDatasource{
		queryCache: NewCache(10*time.Minute, 10*time.Minute),
		httpClient: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					Renegotiation: tls.RenegotiateFreelyAsClient,
				},
				Proxy: http.ProxyFromEnvironment,
				Dial: (&net.Dialer{
					Timeout:   30 * time.Second,
					KeepAlive: 30 * time.Second,
				}).Dial,
				TLSHandshakeTimeout:   10 * time.Second,
				ExpectContinueTimeout: 1 * time.Second,
				MaxIdleConns:          100,
				IdleConnTimeout:       90 * time.Second,
			},
			Timeout: time.Duration(time.Second * 30),
		},
	}
}

// ZabbixAPIQuery handles query requests to Zabbix
func (ds *ZabbixDatasource) ZabbixAPIQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	result, queryExistInCache := ds.queryCache.Get(HashString(tsdbReq.String()))

	if !queryExistInCache {
		dsInfo := tsdbReq.GetDatasource()

		jsonQueries := make([]*simplejson.Json, 0)
		for _, query := range tsdbReq.Queries {
			json, err := simplejson.NewJson([]byte(query.ModelJson))

			if err != nil {
				return nil, err
			} else {
				apiMethod := json.GetPath("target", "method").MustString()
				apiParams := json.GetPath("target", "params").MustMap()
				ds.logger.Debug("ZabbixAPIQuery", "method", apiMethod, "params", apiParams)

			}

			jsonQueries = append(jsonQueries, json)
		}

		if len(jsonQueries) == 0 {
			return nil, errors.New("At least one query should be provided")
		}

		jsonQuery := jsonQueries[0].Get("target")
		apiMethod := jsonQuery.Get("method").MustString()
		apiParams := jsonQuery.Get("params").MustMap()

		var err error
		result, err = ds.ZabbixRequest(ctx, dsInfo, apiMethod, apiParams)
		ds.queryCache.Set(HashString(tsdbReq.String()), result)
		if err != nil {
			ds.logger.Debug("ZabbixAPIQuery", "error", err)
			return nil, errors.New("ZabbixAPIQuery is not implemented yet")
		}
	}

	resultByte, _ := result.(*simplejson.Json).MarshalJSON()
	ds.logger.Debug("ZabbixAPIQuery", "result", string(resultByte))

	return BuildResponse(result)
}

// TestConnection checks authentication and version of the Zabbix API and returns that info
func (ds *ZabbixDatasource) TestConnection(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	dsInfo := tsdbReq.GetDatasource()

	auth, err := ds.loginWithDs(ctx, dsInfo)
	if err != nil {
		return BuildErrorResponse(fmt.Errorf("Authentication failed: %w", err)), nil
	}
	ds.authToken = auth

	response, err := ds.zabbixAPIRequest(ctx, dsInfo.GetUrl(), "apiinfo.version", map[string]interface{}{}, "")
	if err != nil {
		ds.logger.Debug("TestConnection", "error", err)
		return BuildErrorResponse(fmt.Errorf("Version check failed: %w", err)), nil
	}

	resultByte, _ := response.MarshalJSON()
	ds.logger.Debug("TestConnection", "result", string(resultByte))

	testResponse := connectionTestResponse{
		ZabbixVersion: response.MustString(),
	}

	return BuildResponse(testResponse)
}

// ZabbixRequest checks authentication and makes a request to the Zabbix API
func (ds *ZabbixDatasource) ZabbixRequest(ctx context.Context, dsInfo *datasource.DatasourceInfo, method string, params map[string]interface{}) (*simplejson.Json, error) {
	zabbixURL := dsInfo.GetUrl()

	var result *simplejson.Json
	var err error

	for attempt := 0; attempt <= 3; attempt++ {
		if ds.authToken == "" {
			// Authenticate
			ds.authToken, err = ds.loginWithDs(ctx, dsInfo)
			if err != nil {
				return nil, err
			}
		}
		result, err = ds.zabbixAPIRequest(ctx, zabbixURL, method, params, ds.authToken)
		if err == nil || (err != nil && !isNotAuthorized(err.Error())) {
			break
		} else {
			ds.authToken = ""
		}
	}
	return result, err
}

func (ds *ZabbixDatasource) loginWithDs(ctx context.Context, dsInfo *datasource.DatasourceInfo) (string, error) {
	zabbixURLStr := dsInfo.GetUrl()
	zabbixURL, err := url.Parse(zabbixURLStr)
	if err != nil {
		return "", err
	}

	jsonDataStr := dsInfo.GetJsonData()
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return "", err
	}

	zabbixLogin := jsonData.Get("username").MustString()
	var zabbixPassword string
	if securePassword, exists := dsInfo.GetDecryptedSecureJsonData()["password"]; exists {
		zabbixPassword = securePassword
	} else {
		zabbixPassword = jsonData.Get("password").MustString()
	}

	auth, err := ds.login(ctx, zabbixURLStr, zabbixLogin, zabbixPassword)
	if err != nil {
		ds.logger.Error("loginWithDs", "error", err)
		return "", err
	}
	ds.logger.Debug("loginWithDs", "url", zabbixURL, "user", zabbixLogin, "auth", auth)

	return auth, nil
}

func (ds *ZabbixDatasource) login(ctx context.Context, apiURL string, username string, password string) (string, error) {
	params := map[string]interface{}{
		"user":     username,
		"password": password,
	}
	auth, err := ds.zabbixAPIRequest(ctx, apiURL, "user.login", params, "")
	if err != nil {
		return "", err
	}

	return auth.MustString(), nil
}

func (ds *ZabbixDatasource) zabbixAPIRequest(ctx context.Context, apiURL string, method string, params map[string]interface{}, auth string) (*simplejson.Json, error) {
	zabbixURL, err := url.Parse(apiURL)

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

	reqBodyJSON, err := json.Marshal(apiRequest)
	if err != nil {
		return nil, err
	}

	var body io.Reader
	body = bytes.NewReader(reqBodyJSON)
	rc, ok := body.(io.ReadCloser)
	if !ok && body != nil {
		rc = ioutil.NopCloser(body)
	}

	req := &http.Request{
		Method: "POST",
		URL:    zabbixURL,
		Header: map[string][]string{
			"Content-Type": {"application/json"},
		},
		Body: rc,
	}

	response, err := makeHTTPRequest(ctx, ds.httpClient, req)
	if err != nil {
		return nil, err
	}

	ds.logger.Debug("zabbixAPIRequest", "response", string(response))

	return handleAPIResult(response)
}

func handleAPIResult(response []byte) (*simplejson.Json, error) {
	jsonResp, err := simplejson.NewJson([]byte(response))
	if err != nil {
		return nil, err
	}
	if errJSON, isError := jsonResp.CheckGet("error"); isError {
		errMessage := fmt.Sprintf("%s %s", errJSON.Get("message").MustString(), errJSON.Get("data").MustString())
		return nil, errors.New(errMessage)
	}
	jsonResult := jsonResp.Get("result")
	return jsonResult, nil
}

func makeHTTPRequest(ctx context.Context, httpClient *http.Client, req *http.Request) ([]byte, error) {
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

func isNotAuthorized(message string) bool {
	return message == "Session terminated, re-login, please." ||
		message == "Not authorised." ||
		message == "Not authorized."
}

func (ds *ZabbixDatasource) queryNumericItems(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
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

	jsonQuery := jsonQueries[0].Get("target")
	groupFilter := jsonQuery.GetPath("group", "filter").MustString()
	hostFilter := jsonQuery.GetPath("host", "filter").MustString()
	appFilter := jsonQuery.GetPath("application", "filter").MustString()
	itemFilter := jsonQuery.GetPath("item", "filter").MustString()

	items, err := ds.getItems(ctx, tsdbReq.GetDatasource(), groupFilter, hostFilter, appFilter, itemFilter, "num")
	if err != nil {
		return nil, err
	}

	metrics, err := ds.queryNumericDataForItems(ctx, tsdbReq, items, jsonQueries, isUseTrend(tsdbReq.GetTimeRange()))
	if err != nil {
		return nil, err
	}

	return BuildMetricsResponse(metrics)
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

	return ds.ZabbixRequest(ctx, dsInfo, "item.get", params.MustMap())
}

func (ds *ZabbixDatasource) getAllApps(ctx context.Context, dsInfo *datasource.DatasourceInfo, hostids []string) (*simplejson.Json, error) {
	params := make(map[string]interface{})
	params["output"] = "extend"

	if len(hostids) > 0 {
		params["hostids"] = hostids
	}

	return ds.ZabbixRequest(ctx, dsInfo, "application.get", params)
}

func (ds *ZabbixDatasource) getAllHosts(ctx context.Context, dsInfo *datasource.DatasourceInfo, groupids []string) (*simplejson.Json, error) {
	params := make(map[string]interface{})
	params["output"] = []string{"name", "host"}
	params["sortfield"] = "name"

	if len(groupids) > 0 {
		params["groupids"] = groupids
	}

	return ds.ZabbixRequest(ctx, dsInfo, "host.get", params)
}

func (ds *ZabbixDatasource) getAllGroups(ctx context.Context, dsInfo *datasource.DatasourceInfo) (*simplejson.Json, error) {
	params := make(map[string]interface{})
	params["output"] = []string{"name"}
	params["sortfield"] = "name"
	params["real_hosts"] = true

	return ds.ZabbixRequest(ctx, dsInfo, "hostgroup.get", params)
}
func (ds *ZabbixDatasource) queryNumericDataForItems(ctx context.Context, tsdbReq *datasource.DatasourceRequest, items []*simplejson.Json, jsonQueries []*simplejson.Json, useTrend bool) ([]*datasource.TimeSeries, error) {
	valueType := ds.getTrendValueType(jsonQueries)
	var consolidateBy string
	if ds.getConsolidateBy(jsonQueries) != "" {
		consolidateBy = ds.getConsolidateBy(jsonQueries)
	} else {
		consolidateBy = valueType
	}
	ds.logger.Info(consolidateBy)

	history, err := ds.getHistotyOrTrend(ctx, tsdbReq, items, useTrend)
	if err != nil {
		return nil, err
	}

	zItems := zabbix.Items{}
	for _, item := range items {
		zItem, ok := item.Interface().(zabbix.Item)
		if !ok {
			return nil, fmt.Errorf("Unable to convert simplejson Item to zabbix.Item: %s", item.MustString())
		}
		zItems = append(zItems, zItem)
	}

	return convertHistory(history, zItems)
}
func (ds *ZabbixDatasource) getTrendValueType(jsonQueries []*simplejson.Json) string {
	var trendFunctions []string
	var trendValueFunc string

	// TODO: loop over actual returned categories
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

func (ds *ZabbixDatasource) getHistotyOrTrend(ctx context.Context, tsdbReq *datasource.DatasourceRequest, items []*simplejson.Json, useTrend bool) (zabbix.History, error) {
	history := zabbix.History{}

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

		params := make(map[string]interface{})
		params["output"] = []string{"extend"}
		params["sortfield"] = "clock"
		params["sortorder"] = "ASC"
		params["history"] = k
		params["itemids"] = itemids
		params["time_from"] = timeRange.GetFromRaw

		if timeRange.GetToRaw() != "" {
			params["time_till"] = timeRange.GetToRaw()
		}

		var response *simplejson.Json
		var err error

		if useTrend {
			response, err = ds.ZabbixRequest(ctx, tsdbReq.GetDatasource(), "trend.get", params)
		} else {
			response, err = ds.ZabbixRequest(ctx, tsdbReq.GetDatasource(), "history.get", params)
		}

		if err != nil {
			return nil, err
		}
		point, ok := response.Interface().(zabbix.HistoryPoint)
		if ok {
			history = append(history, point)
		} else {
			ds.logger.Warn("Could not map Zabbix response to History Point")
		}
	}
	return history, nil
}

func isUseTrend(timeRange *datasource.TimeRange) bool {
	if (timeRange.GetFromEpochMs() < 7*24*time.Hour.Nanoseconds()/1000000) ||
		(timeRange.GetFromEpochMs()-timeRange.GetToEpochMs() > 4*24*time.Hour.Nanoseconds()/1000000) {
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
