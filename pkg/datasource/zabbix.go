package datasource

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ZabbixAPIQuery handles query requests to Zabbix API
func (ds *ZabbixDatasourceInstance) ZabbixAPIQuery(ctx context.Context, apiReq *zabbix.ZabbixAPIRequest) (*ZabbixAPIResourceResponse, error) {
	resultJson, err := ds.zabbix.Request(ctx, apiReq)
	if err != nil {
		return nil, err
	}
	result := resultJson.Interface()
	return BuildAPIResponse(&result)
}

func BuildAPIResponse(responseData *interface{}) (*ZabbixAPIResourceResponse, error) {
	return &ZabbixAPIResourceResponse{
		Result: *responseData,
	}, nil
}

// TestConnection checks authentication and version of the Zabbix API and returns that info
func (ds *ZabbixDatasourceInstance) TestConnection(ctx context.Context) (string, error) {
	_, err := ds.zabbix.GetAllGroups(ctx)
	if err != nil {
		return "", err
	}

	zabbixVersion, err := ds.zabbix.GetFullVersion(ctx)
	if err != nil {
		return "", err
	}

	return zabbixVersion, nil
}

func (ds *ZabbixDatasourceInstance) queryNumericItems(ctx context.Context, query *QueryModel) ([]*data.Frame, error) {
	groupFilter := query.Group.Filter
	hostFilter := query.Host.Filter
	appFilter := query.Application.Filter
	itemTagFilter := query.ItemTag.Filter
	itemFilter := query.Item.Filter
	showDisabled := query.Options.ShowDisabledItems

	var items []*zabbix.Item
	var err error
	zabbixVersion, err := ds.zabbix.GetVersion(ctx)
	if err != nil {
		ds.logger.Warn("Error getting Zabbix version")
	}

	if zabbixVersion >= 54 {
		items, err = ds.zabbix.GetItems(ctx, groupFilter, hostFilter, itemTagFilter, itemFilter, "num", showDisabled)
	} else {
		items, err = ds.zabbix.GetItemsBefore54(ctx, groupFilter, hostFilter, appFilter, itemFilter, "num", showDisabled)
	}

	if err != nil {
		return nil, err
	}

	frames, err := ds.queryNumericDataForItems(ctx, query, items)
	if err != nil {
		return nil, err
	}

	return frames, nil
}

func (ds *ZabbixDatasourceInstance) queryItemIdData(ctx context.Context, query *QueryModel) ([]*data.Frame, error) {
	// Validate itemids before processing
	if err := ValidateItemIDs(query.ItemIDs); err != nil {
		return nil, err
	}

	itemids := strings.Split(query.ItemIDs, ",")
	for i, id := range itemids {
		itemids[i] = strings.Trim(id, " ")
	}

	items, err := ds.zabbix.GetItemsByIDs(ctx, itemids)
	if err != nil {
		return nil, err
	}

	frames, err := ds.queryNumericDataForItems(ctx, query, items)
	if err != nil {
		return nil, err
	}

	return frames, nil
}

func (ds *ZabbixDatasourceInstance) queryNumericDataForItems(ctx context.Context, query *QueryModel, items []*zabbix.Item) ([]*data.Frame, error) {
	trendValueType := ds.getTrendValueType(query)
	consolidateBy := ds.getConsolidateBy(query)

	if consolidateBy != "" {
		trendValueType = consolidateBy
	}

	err := applyFunctionsPre(query, items)
	if err != nil {
		return nil, err
	}

	history, err := ds.getHistotyOrTrend(ctx, query, items, trendValueType)
	if err != nil {
		return nil, err
	}

	series := convertHistoryToTimeSeries(history, items)
	return ds.applyDataProcessing(ctx, query, series, false)
}

func (ds *ZabbixDatasourceInstance) applyDataProcessing(ctx context.Context, query *QueryModel, series []*timeseries.TimeSeriesData, DBPostProcessing bool) ([]*data.Frame, error) {
	consolidateBy := ds.getConsolidateBy(query)
	useTrend := ds.isUseTrend(query.TimeRange, query)

	// Sort trend data (in some cases Zabbix API returns it unsorted)
	if useTrend {
		sortSeriesPoints(series)
	}

	// Align time series data if possible
	disableDataAlignment := query.Options.DisableDataAlignment || ds.Settings.DisableDataAlignment || query.QueryType == MODE_ITSERVICE
	if !disableDataAlignment {
		if useTrend {
			// Skip if data fetched directly from DB (it already contains nulls)
			if !DBPostProcessing {
				for _, s := range series {
					// Trend data is already aligned (by 1 hour interval), but null values should be added
					s.TS = s.TS.FillTrendWithNulls()
				}
			}
		} else {
			for _, s := range series {
				// Skip unnecessary data alignment if item interval less than query interval
				// because data will be downsampled in this case. 2 multiplier used to prevent situations when query and item
				// intervals are the same, but downsampling will be performed (query interval is rounded value of time range / max data points).
				if s.Meta.Interval != nil && *s.Meta.Interval*2 > query.Interval {
					s.TS = s.TS.Align(*s.Meta.Interval)
				}
			}
		}

		if len(series) > 1 {
			series = timeseries.PrepareForStack(series)
		}
	}

	series, err := applyFunctions(series, query.Functions)
	if err != nil {
		return nil, err
	}

	for _, s := range series {
		if int64(s.Len()) > query.MaxDataPoints && query.Interval > 0 {
			downsampleFunc := consolidateBy
			if downsampleFunc == "" {
				downsampleFunc = "avg"
			}
			downsampled, err := applyGroupBy(s.TS, query.Interval.String(), downsampleFunc)
			if err == nil {
				s.TS = downsampled
			} else {
				ds.logger.Debug("Error downsampling series", "error", err)
			}
		}
	}

	valueMaps := make([]zabbix.ValueMap, 0)
	if query.Options.UseZabbixValueMapping {
		valueMaps, err = ds.zabbix.GetValueMappings(ctx)
		if err != nil {
			ds.logger.Error("Error getting value maps", "error", err)
			valueMaps = []zabbix.ValueMap{}
		}
	}
	frames := convertTimeSeriesToDataFrames(series, valueMaps)
	return frames, nil
}

func (ds *ZabbixDatasourceInstance) getTrendValueType(query *QueryModel) string {
	trendValue := "avg"

	for _, fn := range query.Functions {
		if fn.Def.Name == "trendValue" && len(fn.Params) > 0 {
			trendValue = fn.Params[0].(string)
		}
	}

	return trendValue
}

func (ds *ZabbixDatasourceInstance) getConsolidateBy(query *QueryModel) string {
	consolidateBy := ""

	for _, fn := range query.Functions {
		if fn.Def.Name == "consolidateBy" && len(fn.Params) > 0 {
			consolidateBy = fn.Params[0].(string)
		}
	}
	return consolidateBy
}

func (ds *ZabbixDatasourceInstance) getHistotyOrTrend(ctx context.Context, query *QueryModel, items []*zabbix.Item, trendValueType string) (zabbix.History, error) {
	timeRange := query.TimeRange
	useTrend := ds.isUseTrend(timeRange, query)

	if useTrend {
		result, err := ds.zabbix.GetTrend(ctx, items, timeRange)
		if err != nil {
			return nil, err
		}
		return convertTrendToHistory(result, trendValueType)
	}

	return ds.zabbix.GetHistory(ctx, items, timeRange)
}

func (ds *ZabbixDatasourceInstance) isUseTrend(timeRange backend.TimeRange, query *QueryModel) bool {
	if query.Options.UseTrends == "false" {
		return false
	}

	trendsFrom := ds.Settings.TrendsFrom
	trendsRange := ds.Settings.TrendsRange
	fromSec := timeRange.From.Unix()
	toSec := timeRange.To.Unix()
	rangeSec := float64(toSec - fromSec)

	trendTimeRange := (fromSec < time.Now().Add(-trendsFrom).Unix()) || (rangeSec > trendsRange.Seconds())
	useTrendsToggle := query.Options.UseTrends == "true" || ds.Settings.Trends
	return trendTimeRange && useTrendsToggle
}

// queryMultiMetricTable queries Zabbix for multiple metrics across multiple entities and returns a table
// where each row represents a unique entity (e.g., network interface) and each column represents a metric.
// Entities are grouped by host and entity name to handle multiple hosts matching the filter.
func (ds *ZabbixDatasourceInstance) queryMultiMetricTable(ctx context.Context, query *QueryModel) ([]*data.Frame, error) {
	ds.logger.Debug("Querying multi-metric table", "query", query)

	if query.TableConfig == nil || len(query.TableConfig.Metrics) == 0 {
		ds.logger.Debug("No tableConfig or metrics defined")
		return []*data.Frame{}, nil
	}

	entityPattern := query.TableConfig.EntityPattern

	entityItems, err := ds.zabbix.GetItemsWithLastValue(ctx, query.Group.Filter, query.Host.Filter, query.Application.Filter, "", entityPattern.Pattern)
	if err != nil {
		ds.logger.Error("Error fetching entity items", "error", err)
		return nil, err
	}

	ds.logger.Debug("Entity items found", "count", len(entityItems))

	if len(entityItems) == 0 {
		ds.logger.Debug("No entity items found, returning empty frame")
		return []*data.Frame{}, nil
	}

	// Extract hosts to check if we have multiple hosts
	hostsMap := make(map[string]bool)
	for _, item := range entityItems {
		if len(item.Hosts) > 0 {
			hostsMap[item.Hosts[0].Name] = true
		}
	}
	hasMultipleHosts := len(hostsMap) > 1

	// Create composite key: group|host|entity for proper grouping
	type EntityInfo struct {
		Item         *zabbix.Item
		Group        string
		Host         string
		Entity       string
		CompositeKey string
	}

	entityMap := make(map[string]*EntityInfo)
	entityOrder := []string{}

	for _, item := range entityItems {
		entityLabel := ds.extractEntityLabel(item, entityPattern)

		// Get host name
		hostName := ""
		if len(item.Hosts) > 0 {
			hostName = item.Hosts[0].Name
		}

		// Build composite key: host|entity (always group by host AND entity)
		compositeKey := hostName + "|" + entityLabel

		if _, exists := entityMap[compositeKey]; !exists {
			entityMap[compositeKey] = &EntityInfo{
				Item:         item,
				Group:        query.Group.Filter, // Store the filter pattern
				Host:         hostName,
				Entity:       entityLabel,
				CompositeKey: compositeKey,
			}
			entityOrder = append(entityOrder, compositeKey)
		}
	}

	ds.logger.Debug("Unique entities", "count", len(entityOrder), "multipleHosts", hasMultipleHosts)

	// Create frame
	frame := data.NewFrame(query.RefID)

	// Add Group column if requested
	if query.TableConfig.ShowGroupColumn {
		groupValues := make([]string, len(entityOrder))
		for i, key := range entityOrder {
			groupValues[i] = entityMap[key].Group
		}
		frame.Fields = append(frame.Fields, data.NewField("Group", nil, groupValues))
	}

	// Add Host column if requested OR if there are multiple hosts (always show host when multiple)
	if query.TableConfig.ShowHostColumn || hasMultipleHosts {
		hostValues := make([]string, len(entityOrder))
		for i, key := range entityOrder {
			hostValues[i] = entityMap[key].Host
		}
		frame.Fields = append(frame.Fields, data.NewField("Host", nil, hostValues))
	}

	// Add Entity column
	entityValues := make([]string, len(entityOrder))
	for i, key := range entityOrder {
		entityValues[i] = entityMap[key].Entity
	}
	frame.Fields = append(frame.Fields, data.NewField("Entity", nil, entityValues))

	// Process metrics
	for _, metric := range query.TableConfig.Metrics {
		var columnValues []*string

		if metric.Aggregation == "last" {
			metricItems, err := ds.zabbix.GetItemsWithLastValue(ctx, query.Group.Filter, query.Host.Filter, query.Application.Filter, "", metric.Pattern)
			if err != nil {
				ds.logger.Error("Error fetching metric items", "error", err, "column", metric.ColumnName)
				continue
			}

			// Map metric values by composite key (host|entity)
			metricValues := make(map[string]*string)
			for _, item := range metricItems {
				entityLabel := ds.extractEntityLabel(item, entityPattern)
				hostName := ""
				if len(item.Hosts) > 0 {
					hostName = item.Hosts[0].Name
				}
				compositeKey := hostName + "|" + entityLabel
				metricValues[compositeKey] = item.LastValue
			}

			columnValues = make([]*string, len(entityOrder))
			for i, key := range entityOrder {
				columnValues[i] = metricValues[key]
			}
		} else {
			// Aggregation logic
			metricItems, err := ds.zabbix.GetItemsWithLastValue(ctx, query.Group.Filter, query.Host.Filter, query.Application.Filter, "", metric.Pattern)
			if err != nil {
				ds.logger.Error("Error fetching metric items", "error", err, "column", metric.ColumnName)
				continue
			}

			history, err := ds.zabbix.GetHistory(ctx, metricItems, query.TimeRange)
			if err != nil {
				ds.logger.Error("Error fetching history", "error", err, "column", metric.ColumnName)
				continue
			}

			aggregatedValues := ds.aggregateHistoryWithHost(history, metricItems, entityPattern, metric.Aggregation)

			columnValues = make([]*string, len(entityOrder))
			for i, key := range entityOrder {
				if val, exists := aggregatedValues[key]; exists {
					columnValues[i] = &val
				}
			}
		}

		frame.Fields = append(frame.Fields, data.NewField(metric.ColumnName, nil, columnValues))
	}

	// Log final field names
	fieldNames := []string{}
	for _, f := range frame.Fields {
		fieldNames = append(fieldNames, f.Name)
	}

	return []*data.Frame{frame}, nil
}

func (ds *ZabbixDatasourceInstance) extractEntityLabel(item *zabbix.Item, pattern EntityPatternConfig) string {
	var source string
	if pattern.SearchType == "itemName" {
		source = item.Name
	} else {
		source = item.Key
	}

	if pattern.ExtractNameRegex != "" {
		// Apply regex extraction
		re, err := regexp.Compile(pattern.ExtractNameRegex)
		if err != nil {
			ds.logger.Warn("Invalid extract regex", "regex", pattern.ExtractNameRegex, "error", err)
			return source
		}

		matches := re.FindStringSubmatch(source)
		if len(matches) > 1 {
			// Return first capture group
			return matches[1]
		}

		ds.logger.Debug("Regex did not match or no capture group", "source", source, "regex", pattern.ExtractNameRegex)
		return source
	}

	return source
}

func (ds *ZabbixDatasourceInstance) aggregateHistoryWithHost(history zabbix.History, items []*zabbix.Item, pattern EntityPatternConfig, aggregation string) map[string]string {
	// Group history by itemid
	historyByItem := make(map[string][]float64)
	for _, h := range history {
		historyByItem[h.ItemID] = append(historyByItem[h.ItemID], h.Value)
	}

	// Calculate aggregation per composite key (host|entity)
	result := make(map[string]string)
	for _, item := range items {
		entityLabel := ds.extractEntityLabel(item, pattern)
		hostName := ""
		if len(item.Hosts) > 0 {
			hostName = item.Hosts[0].Name
		}
		compositeKey := hostName + "|" + entityLabel

		values := historyByItem[item.ID]

		if len(values) == 0 {
			continue
		}

		var aggregatedValue float64
		switch aggregation {
		case "avg":
			sum := 0.0
			for _, v := range values {
				sum += v
			}
			aggregatedValue = sum / float64(len(values))
		case "min":
			aggregatedValue = values[0]
			for _, v := range values {
				if v < aggregatedValue {
					aggregatedValue = v
				}
			}
		case "max":
			aggregatedValue = values[0]
			for _, v := range values {
				if v > aggregatedValue {
					aggregatedValue = v
				}
			}
		case "sum":
			sum := 0.0
			for _, v := range values {
				sum += v
			}
			aggregatedValue = sum
		case "median":
			// Sort values and find median
			sortedValues := make([]float64, len(values))
			copy(sortedValues, values)
			sort.Float64s(sortedValues)

			n := len(sortedValues)
			if n%2 == 0 {
				// Even number: average of two middle values
				aggregatedValue = (sortedValues[n/2-1] + sortedValues[n/2]) / 2.0
			} else {
				// Odd number: middle value
				aggregatedValue = sortedValues[n/2]
			}
		case "p95":
			// Sort values and find 95th percentile
			sortedValues := make([]float64, len(values))
			copy(sortedValues, values)
			sort.Float64s(sortedValues)

			// Calculate index for 95th percentile
			n := len(sortedValues)
			index := int(math.Ceil(0.95*float64(n))) - 1
			if index < 0 {
				index = 0
			}
			if index >= n {
				index = n - 1
			}
			aggregatedValue = sortedValues[index]
		}

		result[compositeKey] = fmt.Sprintf("%.2f", aggregatedValue)
	}

	return result
}
