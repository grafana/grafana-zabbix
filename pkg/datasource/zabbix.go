package datasource

import (
	"context"
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
