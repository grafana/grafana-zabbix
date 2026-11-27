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
		items, err = ds.zabbix.GetItems(ctx, groupFilter, hostFilter, itemTagFilter, itemFilter, "num", showDisabled, query.HostTags, string(query.EvalType))
	} else {
		items, err = ds.zabbix.GetItemsBefore54(ctx, groupFilter, hostFilter, appFilter, itemFilter, "num", showDisabled, query.HostTags, string(query.EvalType))
	}

	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return []*data.Frame{}, nil
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

func (ds *ZabbixDatasourceInstance) queryMultiMetricTable(ctx context.Context, query *QueryModel) ([]*data.Frame, error) {
	ds.logger.Debug("Querying multi-metric table")

	if query.TableConfig == nil || len(query.TableConfig.Metrics) == 0 {
		return []*data.Frame{}, nil
	}

	entityPattern := query.TableConfig.EntityPattern
	rowsFromHost := query.TableConfig.RowsFromHost()

	// The extract pattern is compiled per item further down; validate it once here so an invalid
	// regex fails the query instead of silently turning every item into its own row. Host rows
	// don't use it, so a value left over from Item pattern mode is ignored there.
	if !rowsFromHost && entityPattern.ExtractPattern != "" {
		if _, err := regexp.Compile(entityPattern.ExtractPattern); err != nil {
			return nil, backend.DownstreamError(fmt.Errorf("invalid regex in extract pattern %q: %w", entityPattern.ExtractPattern, err))
		}
	}

	// An empty or unknown aggregation would otherwise show 0.00 in every row. Text and sparkline
	// columns don't aggregate, so their value is ignored.
	for _, metric := range query.TableConfig.Metrics {
		if metric.IsText() || metric.ShowSparkline {
			continue
		}
		switch metric.Aggregation {
		case "last", "avg", "min", "max", "sum", "median", "p95":
		default:
			return nil, backend.DownstreamError(fmt.Errorf("metric column %q: unsupported aggregation %q, expected one of last, avg, min, max, sum, median, p95", metric.ColumnName, metric.Aggregation))
		}
	}

	type EntityInfo struct {
		Item            *zabbix.Item
		Host            string
		Entity          string
		ExtractedValues []string
		TagValues       []string
		CompositeKey    string
	}

	entityMap := make(map[string]*EntityInfo)
	entityOrder := []string{}
	hasMultipleHosts := false

	var entityItems []*zabbix.Item
	var err error

	// Step 1 (entity-pattern rows only): discover rows from items matching the entity pattern.
	// Host rows are built after the metric pools are fetched (from the hosts of matched items).
	if !rowsFromHost {
		// item.get is filtered by host and value type only: GetItemsWithLastValue matches its item
		// filter against names in memory after the request. So fetch everything and apply the
		// pattern, by name or by key, once here.
		entityItems, err = ds.zabbix.GetItemsWithLastValue(ctx, query.Group.Filter, query.Host.Filter, query.Application.Filter, "", "/.*/", "num", query.HostTags, string(query.EvalType))
		if err != nil {
			ds.logger.Error("Error fetching entity items", "error", err)
			return nil, err
		}
		entityItems, err = ds.filterItemsByPattern(entityItems, entityPattern.Pattern, entityPattern.SearchType)
		if err != nil {
			return nil, fmt.Errorf("table rows %w", err)
		}

		ds.logger.Debug("Entity items found", "count", len(entityItems))

		if len(entityItems) == 0 {
			return []*data.Frame{}, nil
		}

		// Extract hosts to check if we have multiple hosts
		hostsMap := make(map[string]bool)
		for _, item := range entityItems {
			if len(item.Hosts) > 0 {
				hostsMap[item.Hosts[0].Name] = true
			}
		}
		hasMultipleHosts = len(hostsMap) > 1

		for _, item := range entityItems {
			entityLabel, extractedValues := ds.extractEntityLabelWithGroups(item, entityPattern)

			hostName := ""
			if len(item.Hosts) > 0 {
				hostName = item.Hosts[0].Name
			}

			tagValues := entityTagValues(item, entityPattern)
			compositeKey := entityRowKey(hostName, entityLabel, extractedValues, tagValues)

			if _, exists := entityMap[compositeKey]; !exists {
				entityMap[compositeKey] = &EntityInfo{
					Item:            item,
					Host:            hostName,
					Entity:          entityLabel,
					ExtractedValues: extractedValues,
					TagValues:       tagValues,
					CompositeKey:    compositeKey,
				}
				entityOrder = append(entityOrder, compositeKey)
			}
		}

		ds.logger.Debug("Unique entities", "count", len(entityOrder))
	}

	// Step 2: Build the item pools for the metric columns, one per value type (numeric and text
	// items live under different Zabbix value types). With entity-pattern rows, metric columns
	// select WITHIN the items matching the Table Rows pattern (subset semantics): values join rows
	// via the shared extracted identifier, so items outside the entity pattern could only produce
	// stray keys or wrong matches. The numeric pool is then exactly the entity items fetched above,
	// so only host rows and text columns need another item.get.
	fetchMetricPool := func(itemType string) ([]*zabbix.Item, error) {
		return ds.zabbix.GetItemsWithLastValue(ctx, query.Group.Filter, query.Host.Filter, query.Application.Filter, "", "/.*/", itemType, query.HostTags, string(query.EvalType))
	}

	hasNumMetrics, hasTextMetrics := false, false
	for _, m := range query.TableConfig.Metrics {
		if m.IsText() {
			hasTextMetrics = true
		} else {
			hasNumMetrics = true
		}
	}

	var allMetricItems []*zabbix.Item
	if hasNumMetrics {
		if rowsFromHost {
			allMetricItems, err = fetchMetricPool("num")
			if err != nil {
				ds.logger.Error("Error fetching numeric metric items", "error", err)
				return nil, err
			}
		} else {
			allMetricItems = entityItems
		}
	}

	var allTextMetricItems []*zabbix.Item
	if hasTextMetrics {
		allTextMetricItems, err = fetchMetricPool("text")
		if err != nil {
			ds.logger.Error("Error fetching text metric items", "error", err)
			return nil, err
		}
		if !rowsFromHost {
			allTextMetricItems, err = ds.filterItemsByPattern(allTextMetricItems, entityPattern.Pattern, entityPattern.SearchType)
			if err != nil {
				return nil, fmt.Errorf("table rows %w", err)
			}
		}
	}

	ds.logger.Debug("All metric items fetched", "numCount", len(allMetricItems), "textCount", len(allTextMetricItems))

	metricItemsPerColumn := make([][]*zabbix.Item, len(query.TableConfig.Metrics))
	for i, metric := range query.TableConfig.Metrics {
		pool := allMetricItems
		if metric.IsText() {
			pool = allTextMetricItems
		}
		metricItemsPerColumn[i], err = ds.filterItemsByPattern(pool, metric.Pattern, metric.SearchType)
		if err != nil {
			return nil, fmt.Errorf("metric column %q: %w", metric.ColumnName, err)
		}
		ds.logger.Debug("Filtered metric items", "column", metric.ColumnName, "count", len(metricItemsPerColumn[i]))
	}

	// Step 2b (host rows only): one row per host, sorted alphabetically. Rows are the hosts having
	// at least one item matching any metric column; values are matched to rows by host name alone.
	if rowsFromHost {
		for _, metricItems := range metricItemsPerColumn {
			for _, item := range metricItems {
				if len(item.Hosts) == 0 {
					continue
				}
				hostName := item.Hosts[0].Name
				if _, exists := entityMap[hostName]; !exists {
					entityMap[hostName] = &EntityInfo{
						Item:         item,
						Host:         hostName,
						Entity:       hostName,
						CompositeKey: hostName,
					}
					entityOrder = append(entityOrder, hostName)
				}
			}
		}
		sort.Strings(entityOrder)

		ds.logger.Debug("Unique host rows", "count", len(entityOrder))

		if len(entityOrder) == 0 {
			return []*data.Frame{}, nil
		}
		hasMultipleHosts = len(entityOrder) > 1
	}

	// rowKey maps an item to the row it belongs to: the host name for host rows, or the
	// entity composite key (host + extracted values / entity label) for entity-pattern rows.
	rowKey := func(item *zabbix.Item) string {
		if rowsFromHost {
			if len(item.Hosts) > 0 {
				return item.Hosts[0].Name
			}
			return ""
		}
		return ds.entityCompositeKey(item, entityPattern)
	}

	frame := data.NewFrame(query.RefID)

	// Add Group column if requested: the groups of the row's host that match the Group filter.
	if query.TableConfig.ShowGroupColumn {
		hostGroups, err := ds.zabbix.GetHostGroupNames(ctx, query.Group.Filter)
		if err != nil {
			ds.logger.Error("Error fetching host groups", "error", err)
			return nil, err
		}
		groupValues := make([]string, len(entityOrder))
		for i, key := range entityOrder {
			if hosts := entityMap[key].Item.Hosts; len(hosts) > 0 {
				groupValues[i] = strings.Join(hostGroups[hosts[0].ID], ", ")
			}
		}
		frame.Fields = append(frame.Fields, data.NewField("Group", nil, groupValues))
	}

	// Add Host column if requested OR if there are multiple hosts. Host rows always include it:
	// the host IS the row identity there.
	if rowsFromHost || query.TableConfig.ShowHostColumn || hasMultipleHosts {
		hostValues := make([]string, len(entityOrder))
		for i, key := range entityOrder {
			hostValues[i] = entityMap[key].Host
		}
		frame.Fields = append(frame.Fields, data.NewField("Host", nil, hostValues))
	}

	if !rowsFromHost {
		// Add extracted columns from capture groups
		for _, extractedCol := range entityPattern.ExtractedColumns {
			colValues := make([]string, len(entityOrder))
			for i, key := range entityOrder {
				entityInfo := entityMap[key]
				if extractedCol.GroupIndex > 0 && extractedCol.GroupIndex <= len(entityInfo.ExtractedValues) {
					colValues[i] = entityInfo.ExtractedValues[extractedCol.GroupIndex-1]
				} else {
					colValues[i] = ""
				}
			}
			frame.Fields = append(frame.Fields, data.NewField(extractedCol.Name, nil, colValues))
		}

		// Add tag columns from item tags
		for colIndex, tagCol := range entityPattern.TagColumns {
			colValues := make([]string, len(entityOrder))
			for i, key := range entityOrder {
				colValues[i] = entityMap[key].TagValues[colIndex]
			}
			frame.Fields = append(frame.Fields, data.NewField(tagCol.ColumnName(), nil, colValues))
		}

		// Add Entity column only if no metadata columns (extracted or tag) are defined
		if len(entityPattern.ExtractedColumns) == 0 && len(entityPattern.TagColumns) == 0 {
			entityValues := make([]string, len(entityOrder))
			for i, key := range entityOrder {
				entityValues[i] = entityMap[key].Entity
			}
			frame.Fields = append(frame.Fields, data.NewField("Entity", nil, entityValues))
		}
	}

	// Step 3: Process metrics - filter from allMetricItems instead of fetching separately.
	// A sparkline-enabled column is NOT rendered as a scalar value; instead it emits its own
	// time-series frames (with a distinct RefID) so Grafana's "Time series to table" transformation
	// produces a dedicated "Trend #<column>" sparkline column per metric.
	sparklineFrames := []*data.Frame{}

	for metricIndex, metric := range query.TableConfig.Metrics {
		metricItems := metricItemsPerColumn[metricIndex]

		// Sparkline columns deliver the full history as separate time-series frames and skip the
		// scalar aggregation entirely (aggregation is disabled for them in the query editor).
		// Text columns never render sparklines.
		if metric.ShowSparkline && !metric.IsText() {
			history, err := ds.zabbix.GetHistory(ctx, metricItems, query.TimeRange)
			if err != nil {
				ds.logger.Error("Error fetching sparkline history", "error", err, "column", metric.ColumnName)
				return nil, fmt.Errorf("metric column %q: %w", metric.ColumnName, err)
			}
			sparklineFrames = append(sparklineFrames, ds.buildSparklineFrames(metric, metricItems, history, entityPattern, rowsFromHost)...)
			continue
		}

		// Several items mapping to one row (for example a host-rows pattern matching every CPU core)
		// would make the cell depend on item order. Each cell keeps the first item that has a value,
		// and the panel shows a warning so the pattern can be made exact.
		itemsPerRow := make(map[string]int)
		for _, item := range metricItems {
			itemsPerRow[rowKey(item)]++
		}
		collidingRows := 0
		for _, n := range itemsPerRow {
			if n > 1 {
				collidingRows++
			}
		}
		if collidingRows > 0 {
			frame.AppendNotices(data.Notice{
				Severity: data.NoticeSeverityWarning,
				Text:     fmt.Sprintf("Metric column %q matches more than one item in %d row(s); each cell shows the first matching item that has a value. Use a pattern that matches one item per row.", metric.ColumnName, collidingRows),
			})
		}

		var columnValues []*string

		// Text columns always resolve via lastvalue: history aggregations are meaningless for
		// text/character/log values (the editor locks them to "last" as well).
		if metric.Aggregation == "last" || metric.IsText() {
			metricValues := make(map[string]*string)
			for _, item := range metricItems {
				key := rowKey(item)
				if metricValues[key] == nil {
					metricValues[key] = item.CollectedLastValue()
				}
			}

			columnValues = make([]*string, len(entityOrder))
			for i, key := range entityOrder {
				columnValues[i] = metricValues[key]
			}
		} else {
			history, err := ds.zabbix.GetHistory(ctx, metricItems, query.TimeRange)
			if err != nil {
				ds.logger.Error("Error fetching history", "error", err, "column", metric.ColumnName)
				return nil, fmt.Errorf("metric column %q: %w", metric.ColumnName, err)
			}

			aggregatedValues := ds.aggregateHistoryByKey(history, metricItems, rowKey, metric.Aggregation)

			columnValues = make([]*string, len(entityOrder))
			for i, key := range entityOrder {
				if val, exists := aggregatedValues[key]; exists {
					columnValues[i] = &val
				}
			}
		}

		frame.Fields = append(frame.Fields, data.NewField(metric.ColumnName, nil, columnValues))
	}

	// The scalar table frame comes first. With sparklines it carries only the row dimensions (and
	// any non-sparkline metric columns) and acts as the join base. It has no time field, so the
	// frontend wide-format conversion (isConvertibleToWide) leaves the response alone wherever this
	// query sits among the panel's queries.
	frames := []*data.Frame{frame}
	frames = append(frames, sparklineFrames...)
	return frames, nil
}

// entityCompositeKey builds the same row key used to align metric values with entity rows.
func (ds *ZabbixDatasourceInstance) entityCompositeKey(item *zabbix.Item, pattern EntityPatternConfig) string {
	entityLabel, extractedValues := ds.extractEntityLabelWithGroups(item, pattern)
	hostName := ""
	if len(item.Hosts) > 0 {
		hostName = item.Hosts[0].Name
	}
	return entityRowKey(hostName, entityLabel, extractedValues, entityTagValues(item, pattern))
}

// entityRowKey identifies an entity row: the host plus every metadata value (extracted capture
// groups, then tag column values). Without any metadata the entity label (item name or key)
// identifies the row instead.
func entityRowKey(hostName, entityLabel string, extractedValues, tagValues []string) string {
	parts := []string{hostName}
	if len(extractedValues) > 0 {
		parts = append(parts, extractedValues...)
	} else if len(tagValues) == 0 {
		parts = append(parts, entityLabel)
	}
	parts = append(parts, tagValues...)
	return strings.Join(parts, "|")
}

// entityTagValues returns the item's value for every configured tag column, in column order.
func entityTagValues(item *zabbix.Item, pattern EntityPatternConfig) []string {
	values := make([]string, len(pattern.TagColumns))
	for i, col := range pattern.TagColumns {
		values[i] = itemTagValue(item, col.Tag)
	}
	return values
}

// itemTagValue returns the value of the item's tag with the given name. It is "" when the item
// does not carry the tag, and also for a tag without a value.
func itemTagValue(item *zabbix.Item, tag string) string {
	for _, t := range item.Tags {
		if t.Tag == tag {
			return t.Value
		}
	}
	return ""
}

// sparklineInterval returns the interval used to align a sparkline series: the item's configured
// update interval (e.g. "60s") when it is a fixed value, otherwise the interval detected from the
// data itself. Returns 0 when no interval can be determined (alignment is then skipped).
func sparklineInterval(item *zabbix.Item, ts timeseries.TimeSeries) time.Duration {
	if d := parseItemUpdateInterval(item.Delay); d != nil && *d > 0 {
		return *d
	}
	return ts.DetectInterval()
}

// buildSparklineFrames returns one time-series frame per item whose history was fetched. Each frame
// is a single labeled series so Grafana's "Time series to table" transformation produces a Trend
// (sparkline) column.
//
// The transformation groups frames by RefID and emits exactly one "Trend #<refId>" column per RefID,
// so every sparkline metric is given its OWN RefID (the column name). This yields one sparkline column
// per metric ("wide" layout) instead of a single Trend column with a "metric" dimension column.
// Labels carry only the row-identifying dimensions (Host / extracted and tag columns / Entity, or just Host
// when rows represent hosts) so the per-metric Trend tables can be joined or merged onto each other
// (and onto the scalar table) on those columns.
func (ds *ZabbixDatasourceInstance) buildSparklineFrames(metric MetricColumnConfig, items []*zabbix.Item, history zabbix.History, pattern EntityPatternConfig, rowsFromHost bool) []*data.Frame {
	pointsByItem := make(map[string][]zabbix.HistoryPoint, len(items))
	for _, p := range history {
		pointsByItem[p.ItemID] = append(pointsByItem[p.ItemID], p)
	}

	frames := make([]*data.Frame, 0, len(items))
	for _, item := range items {
		points, ok := pointsByItem[item.ID]
		if !ok || len(points) == 0 {
			continue
		}

		// Convert the raw history into a time series and align it to the item's collection interval,
		// exactly like the normal metric path (queryNumericDataForItems). Zabbix timestamps carry
		// nanosecond precision and history is sorted by whole-second clock only, so the raw points are
		// off-grid and can be non-monotonic within a second, which the sparkline renders as spurious
		// gaps/vertical jumps. Sorting + aligning snaps points to a regular grid, drops same-frame
		// duplicates, and interpolates single-point gaps, producing a continuous line.
		ts := make(timeseries.TimeSeries, 0, len(points))
		for _, p := range points {
			value := p.Value
			ts = append(ts, timeseries.TimePoint{Time: time.Unix(p.Clock, p.NS), Value: &value})
		}
		ts.Sort()
		if interval := sparklineInterval(item, ts); interval > 0 {
			ts = ts.Align(interval)
		}

		hostName := ""
		if len(item.Hosts) > 0 {
			hostName = item.Hosts[0].Name
		}

		labels := data.Labels{}
		if hostName != "" {
			labels["Host"] = hostName
		}
		// Host rows join on the Host label alone; entity-pattern rows also carry their metadata
		// (extracted and tag columns, or the entity label without any) as join dimensions.
		if !rowsFromHost {
			entityLabel, extractedValues := ds.extractEntityLabelWithGroups(item, pattern)
			if len(extractedValues) > 0 {
				for _, col := range pattern.ExtractedColumns {
					if col.GroupIndex > 0 && col.GroupIndex <= len(extractedValues) {
						labels[col.Name] = extractedValues[col.GroupIndex-1]
					}
				}
			} else if len(pattern.TagColumns) == 0 {
				labels["Entity"] = entityLabel
			}
			for i, value := range entityTagValues(item, pattern) {
				labels[pattern.TagColumns[i].ColumnName()] = value
			}
		}

		timeField := data.NewFieldFromFieldType(data.FieldTypeTime, len(ts))
		timeField.Name = data.TimeSeriesTimeFieldName
		valueField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(ts))
		valueField.Name = data.TimeSeriesValueFieldName
		valueField.Labels = labels
		valueField.Config = &data.FieldConfig{DisplayNameFromDS: metric.ColumnName, Custom: map[string]interface{}{"units": item.Units}}

		for i, p := range ts {
			timeField.Set(i, p.Time)
			valueField.Set(i, p.Value)
		}

		f := data.NewFrame(metric.ColumnName, timeField, valueField)
		// Distinct RefID per metric => one "Trend #<column>" column per metric after the transform.
		f.RefID = metric.ColumnName
		f.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}
		frames = append(frames, f)
	}

	return frames
}

// filterItemsByPattern filters items by pattern, following the plugin-wide filter convention:
// "/regex/flags" is a regex, anything else must match the item name/key exactly.
func (ds *ZabbixDatasourceInstance) filterItemsByPattern(items []*zabbix.Item, pattern string, searchType string) ([]*zabbix.Item, error) {
	re, err := zabbix.ParseFilter(pattern)
	if err != nil {
		return nil, fmt.Errorf("pattern %q: %w", pattern, err)
	}

	filtered := []*zabbix.Item{}
	for _, item := range items {
		var source string
		if searchType == "itemName" {
			source = item.Name
		} else {
			source = item.Key
		}

		if re != nil {
			match, err := re.MatchString(source)
			if err != nil {
				return nil, fmt.Errorf("pattern %q: %w", pattern, err)
			}
			if match {
				filtered = append(filtered, item)
			}
		} else if source == pattern {
			filtered = append(filtered, item)
		}
	}

	return filtered, nil
}

func (ds *ZabbixDatasourceInstance) extractEntityLabelWithGroups(item *zabbix.Item, pattern EntityPatternConfig) (string, []string) {
	var source string
	if pattern.SearchType == "itemName" {
		source = item.Name
	} else {
		source = item.Key
	}

	if pattern.ExtractPattern != "" {
		re, err := regexp.Compile(pattern.ExtractPattern)
		if err != nil {
			ds.logger.Warn("Invalid extract regex", "regex", pattern.ExtractPattern, "error", err)
			return source, []string{}
		}

		matches := re.FindStringSubmatch(source)
		if len(matches) > 1 {
			// matches[0] is the full match, matches[1:] are capture groups
			captureGroups := matches[1:]

			// Use first capture group as entity label for backward compatibility
			entityLabel := captureGroups[0]

			return entityLabel, captureGroups
		}
	}

	return source, []string{}
}

// aggregateHistoryByKey aggregates each item's history points and maps the result to the item's
// table row, resolved via keyFunc (entity composite key or host name, depending on the row source).
func (ds *ZabbixDatasourceInstance) aggregateHistoryByKey(history zabbix.History, items []*zabbix.Item, keyFunc func(*zabbix.Item) string, aggregation string) map[string]string {
	historyByItem := make(map[string][]float64)
	for _, h := range history {
		historyByItem[h.ItemID] = append(historyByItem[h.ItemID], h.Value)
	}

	result := make(map[string]string)
	for _, item := range items {
		compositeKey := keyFunc(item)

		values := historyByItem[item.ID]

		// The first item with history keeps the cell when several items map to one row.
		if _, filled := result[compositeKey]; filled || len(values) == 0 {
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
			sortedValues := make([]float64, len(values))
			copy(sortedValues, values)
			sort.Float64s(sortedValues)

			n := len(sortedValues)
			if n%2 == 0 {
				aggregatedValue = (sortedValues[n/2-1] + sortedValues[n/2]) / 2.0
			} else {
				aggregatedValue = sortedValues[n/2]
			}
		case "p95":
			sortedValues := make([]float64, len(values))
			copy(sortedValues, values)
			sort.Float64s(sortedValues)

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
