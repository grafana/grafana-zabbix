package datasource

import (
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func convertHistoryToTimeSeries(history zabbix.History, items []*zabbix.Item) []*timeseries.TimeSeriesData {
	seriesMap := make(map[string]*timeseries.TimeSeriesData, len(items))

	itemsMap := make(map[string]*zabbix.Item, len(items))
	for _, item := range items {
		itemsMap[item.ID] = item
	}

	for _, point := range history {
		pointItem := itemsMap[strconv.FormatInt(point.ItemID, 10)]
		if seriesMap[strconv.FormatInt(point.ItemID, 10)] == nil {
			seriesMap[strconv.FormatInt(point.ItemID, 10)] = timeseries.NewTimeSeriesData()
		}
		pointSeries := seriesMap[strconv.FormatInt(point.ItemID, 10)]
		if pointSeries.Meta.Item == nil {
			itemName := pointItem.ExpandItemName()
			pointSeries.Meta.Item = pointItem
			pointSeries.Meta.Item.Name = itemName
			pointSeries.Meta.Name = itemName
			if len(pointItem.Hosts) > 0 {
				pointSeries.Meta.Name = fmt.Sprintf("%s: %s", pointItem.Hosts[0].Name, itemName)
			}
			pointSeries.Meta.Interval = parseItemUpdateInterval(pointItem.Delay)
		}

		value := point.Value
		pointSeries.Add(timeseries.TimePoint{
			Time:  time.Unix(point.Clock, point.NS),
			Value: &value,
		})
	}

	series := make([]*timeseries.TimeSeriesData, 0)
	for _, tsd := range seriesMap {
		series = append(series, tsd)
	}

	timeseries.SortByItem(series)
	return series
}

func convertTimeSeriesToDataFrames(series []*timeseries.TimeSeriesData, valuemaps []zabbix.ValueMap) []*data.Frame {
	frames := make([]*data.Frame, 0)

	for _, s := range series {
		frames = append(frames, seriesToDataFrame(s, valuemaps))
	}

	return frames
}

func seriesToDataFrame(series *timeseries.TimeSeriesData, valuemaps []zabbix.ValueMap) *data.Frame {
	timeField := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeField.Name = data.TimeSeriesTimeFieldName

	seriesName := series.Meta.Name
	valueField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)
	valueField.Name = data.TimeSeriesValueFieldName

	item := series.Meta.Item
	if item == nil {
		item = &zabbix.Item{
			Name: seriesName,
		}
	}

	scopedVars := map[string]ScopedVar{
		"__zbx_item":          {Value: item.Name},
		"__zbx_item_name":     {Value: item.Name},
		"__zbx_item_key":      {Value: item.Key},
		"__zbx_item_interval": {Value: item.Delay},
	}

	valueField.Labels = data.Labels{
		"item":     item.Name,
		"item_key": item.Key,
	}

	if len(item.Hosts) > 0 {
		scopedVars["__zbx_host"] = ScopedVar{Value: item.Hosts[0].Name}
		scopedVars["__zbx_host_name"] = ScopedVar{Value: item.Hosts[0].Name}
		valueField.Labels["host"] = item.Hosts[0].Name
	}

	valueField.Config = &data.FieldConfig{
		DisplayNameFromDS: seriesName,
		Custom: map[string]interface{}{
			"scopedVars": scopedVars,
			"units":      item.Units,
		},
	}

	if len(valuemaps) > 0 {
		mappings := getValueMapping(*item, valuemaps)
		valueField.Config.Mappings = mappings
	}

	frame := data.NewFrame(seriesName, timeField, valueField)

	for _, point := range series.TS {
		timeField.Append(point.Time)
		valueField.Append(point.Value)
	}

	return frame
}

func convertTrendToHistory(trend zabbix.Trend, valueType string) (zabbix.History, error) {
	history := make([]zabbix.HistoryPoint, 0)
	for _, point := range trend {
		value, err := getTrendPointValue(point, valueType)
		if err != nil {
			return nil, err
		}

		history = append(history, zabbix.HistoryPoint{
			ItemID: point.ItemID,
			Clock:  point.Clock,
			Value:  value,
		})
	}

	return history, nil
}

func getTrendPointValue(point zabbix.TrendPoint, valueType string) (float64, error) {
	if valueType == "avg" || valueType == "min" || valueType == "max" || valueType == "count" {
		valueStr := point.ValueAvg
		switch valueType {
		case "min":
			valueStr = point.ValueMin
		case "max":
			valueStr = point.ValueMax
		case "count":
			valueStr = point.Num
		}

		value, err := strconv.ParseFloat(valueStr, 64)
		if err != nil {
			return 0, fmt.Errorf("error parsing trend value: %s", err)
		}
		return value, nil
	} else if valueType == "sum" {
		avgStr := point.ValueAvg
		avg, err := strconv.ParseFloat(avgStr, 64)
		if err != nil {
			return 0, fmt.Errorf("error parsing trend value: %s", err)
		}
		countStr := point.Num
		count, err := strconv.ParseFloat(countStr, 64)
		if err != nil {
			return 0, fmt.Errorf("error parsing trend value: %s", err)
		}
		if count > 0 {
			return avg * count, nil
		} else {
			return 0, nil
		}
	}

	return 0, fmt.Errorf("failed to get trend value, unknown value type: %s", valueType)
}

var fixedUpdateIntervalPattern = regexp.MustCompile(`^(\d+)([smhdw]?)$`)

func parseItemUpdateInterval(delay string) *time.Duration {
	if valid := fixedUpdateIntervalPattern.MatchString(delay); !valid {
		return nil
	}

	interval, err := gtime.ParseInterval(delay)
	if err != nil {
		return nil
	}

	return &interval
}

func getValueMapping(item zabbix.Item, valueMaps []zabbix.ValueMap) data.ValueMappings {
	mappings := make([]data.ValueMapping, 0)
	zabbixMap := zabbix.ValueMap{}

	for _, vm := range valueMaps {
		if vm.ID == item.ValueMapID {
			zabbixMap = vm
			break
		}
	}

	if zabbixMap.ID == "" {
		return mappings
	}

	for _, m := range zabbixMap.Mappings {
		mappings = append(mappings, data.ValueMapper{
			m.Value: {
				Text: m.NewValue,
			},
		})
	}
	return mappings
}
