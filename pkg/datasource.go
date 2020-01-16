package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
)

// ZabbixDatasource stores state about a specific datasource and provides methods to make
// requests to the Zabbix API
type ZabbixDatasource struct {
	client ZabbixAPIInterface
	dsInfo *datasource.DatasourceInfo
	hash   string
	logger hclog.Logger
}

// NewZabbixDatasource returns an instance of ZabbixDatasource with an API Client
func NewZabbixDatasource(logger hclog.Logger, dsInfo *datasource.DatasourceInfo) (*ZabbixDatasource, error) {
	client, err := NewZabbixAPIClient(logger, dsInfo.GetUrl())
	if err != nil {
		return nil, err
	}

	return &ZabbixDatasource{
		client: client,
		dsInfo: dsInfo,
		logger: logger,
		hash:   HashDatasourceInfo(dsInfo),
	}, nil
}

// NewZabbixDatasourceWithHash returns an instance of ZabbixDatasource with an API Client and the given identifying hash
func NewZabbixDatasourceWithHash(logger hclog.Logger, dsInfo *datasource.DatasourceInfo, overrideHash string) (*ZabbixDatasource, error) {
	ds, err := NewZabbixDatasource(logger, dsInfo)
	if err != nil {
		return nil, err
	}
	ds.hash = overrideHash

	return ds, nil
}

type FunctionCategories struct {
	Transform []map[string]interface{}
	Aggregate []map[string]interface{}
	Filter    []map[string]interface{}
	Trends    []map[string]interface{}
	Time      []map[string]interface{}
	Alias     []map[string]interface{}
	Special   []map[string]interface{}
}

// DirectQuery handles query requests to Zabbix
func (ds *ZabbixDatasource) ZabbixAPIQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	// result, queryExistInCache := ds.queryCache.Get(HashString(tsdbReq.String()))

	// if queryExistInCache {
	// 	return BuildResponse(result)
	// }

	queries := []requestModel{}
	for _, query := range tsdbReq.Queries {
		request := requestModel{}
		err := json.Unmarshal([]byte(query.GetModelJson()), &request)

		if err != nil {
			return nil, err
		}

		debugParams, _ := json.Marshal(request.Target.Params)

		ds.logger.Debug("DirectQuery", "method", request.Target.Method, "params", string(debugParams))

		queries = append(queries, request)
	}

	if len(queries) == 0 {
		return nil, errors.New("At least one query should be provided")
	}

	query := queries[0]

	response, err := ds.client.APIRequest(ctx, query.Target.Method, query.Target.Params)
	// ds.queryCache.Set(HashString(tsdbReq.String()), response)
	if err != nil {
		newErr := fmt.Errorf("Error in direct query: %w", err)
		ds.logger.Error(newErr.Error())
		return nil, newErr
	}

	return BuildResponse(response)
}

// TestConnection checks authentication and version of the Zabbix API and returns that info
func (ds *ZabbixDatasource) TestConnection(ctx context.Context) (*datasource.DatasourceResponse, error) {
	result, err := ds.client.APIRequest(ctx, "apiinfo.version", ZabbixAPIParams{})
	if err != nil {
		ds.logger.Debug("TestConnection", "error", err)
		return BuildErrorResponse(fmt.Errorf("Version check failed: %w", err)), nil
	}

	ds.logger.Debug("TestConnection", "result", string(result))

	var version string
	err = json.Unmarshal(result, &version)
	if err != nil {
		ds.logger.Error("Internal error while parsing response from Zabbix", err.Error())
		return nil, fmt.Errorf("Internal error while parsing response from Zabbix")
	}

	testResponse := connectionTestResponse{
		ZabbixVersion: version,
	}

	return BuildResponse(testResponse)
}

func (ds *ZabbixDatasource) TimeseriesQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	tStart := time.Now()
	queries := make([]*TargetModel, 0)
	responses := make([]*datasource.QueryResult, 0)
	for _, query := range tsdbReq.Queries {
		var model TargetModel
		err := json.Unmarshal([]byte(query.ModelJson), &model)
		if err != nil {
			ds.logger.Error("Failed to unmarshal query target", "error", err.Error(), "modelJSON", query.ModelJson)
			response := &datasource.QueryResult{
				RefId: query.RefId,
				Error: fmt.Sprintf("Unable to parse query %s\n%s", query.RefId, err.Error()),
			}
			responses = append(responses, response)
			continue
		}

		queries = append(queries, &model)
	}

	if len(queries) == 0 {
		response, err := BuildMetricsResponse(responses)
		if err != nil {
			return nil, err
		}
		return response, errors.New("At least one query should be provided")
	}

	for _, query := range queries {
		ds.logger.Debug("TimeseriesQuery", "func", "ds.getItems", "query", fmt.Sprintf("%+v", query))

		// TODO: Return a client error or a server error and handle them differently
		items, err := ds.getItems(ctx, query.Group.Filter, query.Host.Filter, query.Application.Filter, query.Item.Filter, "num")
		if err != nil {
			return nil, err
		}
		ds.logger.Debug("TimeseriesQuery", "finished", "ds.getItems", "timeElapsed", time.Now().Sub(tStart))

		metrics, err := ds.queryNumericDataForItems(ctx, tsdbReq, items, query, isUseTrend(tsdbReq.GetTimeRange()))
		if err != nil {
			return nil, err
		}
		ds.logger.Debug("TimeseriesQuery", "finished", "queryNumericDataForItems", "timeElapsed", time.Now().Sub(tStart))

		response := &datasource.QueryResult{
			RefId:  query.RefID,
			Series: metrics,
		}
		responses = append(responses, response)
	}

	return BuildMetricsResponse(responses)
}

func (ds *ZabbixDatasource) getItems(ctx context.Context, groupFilter string, hostFilter string, appFilter string, itemFilter string, itemType string) (zabbix.Items, error) {
	tStart := time.Now()

	hosts, err := ds.getHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}

	var hostids []string
	for _, host := range hosts {
		hostids = append(hostids, host.ID)
	}
	ds.logger.Debug("getItems", "finished", "getHosts", "timeElapsed", time.Now().Sub(tStart))

	var items zabbix.Items
	if appFilter == "" {
		items, err = ds.client.GetFilteredItems(ctx, hostids, nil, "num")
		if err != nil {
			return nil, err
		}
	} else {
		apps, err := ds.getApps(ctx, hostids, appFilter)
		if err != nil {
			return nil, err
		}
		var appids []string
		for _, app := range apps {
			appids = append(appids, app.ID)
		}
		ds.logger.Debug("getItems", "finished", "getApps", "timeElapsed", time.Now().Sub(tStart))

		items, err = ds.client.GetFilteredItems(ctx, nil, appids, "num")
		if err != nil {
			return nil, err
		}
	}
	ds.logger.Debug("getItems", "finished", "getAllItems", "timeElapsed", time.Now().Sub(tStart))

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

func (ds *ZabbixDatasource) getApps(ctx context.Context, hostids []string, appFilter string) (zabbix.Applications, error) {
	apps, err := ds.client.GetAppsByHostIDs(ctx, hostids)
	if err != nil {
		return nil, err
	}

	re, err := parseFilter(appFilter)
	if err != nil {
		return nil, err
	}

	filteredApps := zabbix.Applications{}
	for _, app := range apps {
		if re != nil {
			if re.MatchString(app.Name) {
				filteredApps = append(filteredApps, app)
			}
		} else if app.Name == appFilter {
			filteredApps = append(filteredApps, app)
		}
	}
	ds.logger.Debug("getapps", "found", len(apps), "matches", len(filteredApps))
	return filteredApps, nil
}

func (ds *ZabbixDatasource) getHosts(ctx context.Context, groupFilter string, hostFilter string) (zabbix.Hosts, error) {
	groups, err := ds.getGroups(ctx, groupFilter)
	if err != nil {
		return nil, err
	}

	var groupids []string
	for _, group := range groups {
		groupids = append(groupids, group.ID)
	}

	hosts, err := ds.client.GetHostsByGroupIDs(ctx, groupids)
	if err != nil {
		return nil, err
	}

	re, err := parseFilter(hostFilter)
	if err != nil {
		return nil, err
	}

	filteredHosts := zabbix.Hosts{}
	for _, host := range hosts {
		if re != nil {
			if re.MatchString(host.Name) {
				filteredHosts = append(filteredHosts, host)
			}
		} else if host.Name == hostFilter {
			filteredHosts = append(filteredHosts, host)
		}
	}

	ds.logger.Debug("getHosts", "found", len(hosts), "matches", len(filteredHosts))
	return filteredHosts, nil
}

func (ds *ZabbixDatasource) getGroups(ctx context.Context, groupFilter string) (zabbix.Groups, error) {
	groups, err := ds.client.GetAllGroups(ctx)
	if err != nil {
		return nil, err
	}

	re, err := parseFilter(groupFilter)
	if err != nil {
		return nil, err
	}

	filteredGroups := zabbix.Groups{}
	for _, group := range groups {
		if re != nil {
			if re.MatchString(group.Name) {
				filteredGroups = append(filteredGroups, group)
			}
		} else if group.Name == groupFilter {
			filteredGroups = append(filteredGroups, group)
		}
	}

	ds.logger.Debug("getGroups", "found", len(groups), "matches", len(filteredGroups))
	return filteredGroups, nil
}

func (ds *ZabbixDatasource) queryNumericDataForItems(ctx context.Context, tsdbReq *datasource.DatasourceRequest, items zabbix.Items, query *TargetModel, useTrend bool) ([]*datasource.TimeSeries, error) {
	valueType := ds.getTrendValueType(query)
	consolidateBy := ds.getConsolidateBy(query)
	if consolidateBy == "" {
		consolidateBy = valueType
	}
	ds.logger.Info(consolidateBy)

	var timeSeries []*datasource.TimeSeries
	if useTrend {
		trend, err := ds.client.GetTrend(ctx, tsdbReq, items)
		if err != nil {
			return nil, err
		}
		timeSeries = convertTrend(trend, items, valueType)
	} else {
		history, err := ds.client.GetHistory(ctx, tsdbReq, items)
		if err != nil {
			return nil, err
		}
		timeSeries = convertHistory(history, items)
	}

	return timeSeries, nil
}

func (ds *ZabbixDatasource) getTrendValueType(query *TargetModel) string {
	var trendFunctions []string
	var trendValueFunc string

	// TODO: loop over actual returned categories
	for _, trendFn := range new(FunctionCategories).Trends {
		trendFunctions = append(trendFunctions, trendFn["name"].(string))
	}
	for _, fn := range query.Functions {
		for _, trendFn := range trendFunctions {
			if trendFn == fn.Def.Name {
				trendValueFunc = trendFn
			}
		}
	}

	if trendValueFunc == "" {
		trendValueFunc = "avg"
	}

	return trendValueFunc
}

func (ds *ZabbixDatasource) getConsolidateBy(query *TargetModel) string {
	var consolidateBy string

	for _, fn := range query.Functions {
		if fn.Def.Name == "consolidateBy" {
			if len(fn.Params) > 0 {
				consolidateBy = fn.Params[0]
			}
		}
	}
	return consolidateBy
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

func convertHistory(history zabbix.History, items zabbix.Items) []*datasource.TimeSeries {
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
	return seriesList
}

func convertTrend(history zabbix.Trend, items zabbix.Items, trendValueType string) []*datasource.TimeSeries {
	var trendValueFunc func(zabbix.TrendPoint) float64
	switch trendValueType {
	case "min":
		trendValueFunc = func(tp zabbix.TrendPoint) float64 { return tp.ValueMin }
	case "avg":
		trendValueFunc = func(tp zabbix.TrendPoint) float64 { return tp.ValueAvg }
	case "max":
		trendValueFunc = func(tp zabbix.TrendPoint) float64 { return tp.ValueMax }
	}

	seriesMap := map[string]*datasource.TimeSeries{}

	for _, item := range items {
		seriesMap[item.ID] = &datasource.TimeSeries{
			Name:   fmt.Sprintf("%s %s", item.Hosts[0].Name, item.Name),
			Points: []*datasource.Point{},
		}
	}

	for _, point := range history {
		seriesMap[point.ItemID].Points = append(seriesMap[point.ItemID].Points, &datasource.Point{
			Timestamp: point.Clock * 1000,
			Value:     trendValueFunc(point),
		})

	}

	seriesList := []*datasource.TimeSeries{}
	for _, series := range seriesMap {
		seriesList = append(seriesList, series)
	}
	return seriesList
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
