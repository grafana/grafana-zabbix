package datasource

import (
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func convertHistoryToTimeSeries(history zabbix.History, items []*zabbix.Item) []*timeseries.TimeSeriesData {
	seriesMap := make(map[string]*timeseries.TimeSeriesData, len(items))

	itemsMap := make(map[string]*zabbix.Item, len(items))
	for _, item := range items {
		itemsMap[item.ID] = item
	}

	for _, point := range history {
		pointItem := itemsMap[point.ItemID]
		if seriesMap[point.ItemID] == nil {
			seriesMap[point.ItemID] = timeseries.NewTimeSeriesData()
		}
		pointSeries := seriesMap[point.ItemID]
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

func convertTimeSeriesToDataFrame(series []*timeseries.TimeSeriesData) *data.Frame {
	timeFileld := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeFileld.Name = "time"
	frame := data.NewFrame("History", timeFileld)

	if len(series) == 0 {
		return frame
	}

	for _, s := range series {
		field := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)
		field.Name = s.Meta.Name

		frame.Fields = append(frame.Fields, field)
	}

	for i, s := range series {
		currentFieldIndex := i + 1
		for _, point := range s.TS {
			timeFileld.Append(point.Time)
			for fieldIndex, field := range frame.Fields {
				if fieldIndex == currentFieldIndex {
					field.Append(point.Value)
				} else if fieldIndex > 0 {
					field.Append(nil)
				}
			}
		}
	}

	wideFrame, err := data.LongToWide(frame, &data.FillMissing{Mode: data.FillModeNull})
	if err != nil {
		backend.Logger.Debug("Error converting data frame to the wide format", "error", err)
		return frame
	}
	return wideFrame
}

func convertTimeSeriesToDataFrames(series []*timeseries.TimeSeriesData, valuemaps []zabbix.ValueMap) []*data.Frame {
	frames := make([]*data.Frame, 0)

	for _, s := range series {
		frames = append(frames, seriesToDataFrame(s, valuemaps))
	}

	return frames
}

func seriesToDataFrame(series *timeseries.TimeSeriesData, valuemaps []zabbix.ValueMap) *data.Frame {
	timeFileld := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeFileld.Name = data.TimeSeriesTimeFieldName

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
	if len(item.Hosts) > 0 {
		scopedVars["__zbx_host"] = ScopedVar{Value: item.Hosts[0].Name}
		scopedVars["__zbx_host_name"] = ScopedVar{Value: item.Hosts[0].Name}
	}
	valueField.Config = &data.FieldConfig{
		Custom: map[string]interface{}{
			"scopedVars": scopedVars,
		},
	}

	if len(valuemaps) > 0 {
		mappings := getValueMapping(*item, valuemaps)
		valueField.Config.Mappings = mappings
	}

	frame := data.NewFrame(seriesName, timeFileld, valueField)

	for _, point := range series.TS {
		timeFileld.Append(point.Time)
		valueField.Append(point.Value)
	}

	return frame
}

func convertHistoryToDataFrame(history zabbix.History, items []*zabbix.Item) *data.Frame {
	timeFileld := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeFileld.Name = "time"
	frame := data.NewFrame("History", timeFileld)

	for _, item := range items {
		field := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)
		if len(item.Hosts) > 0 {
			field.Name = fmt.Sprintf("%s: %s", item.Hosts[0].Name, item.ExpandItemName())
		} else {
			field.Name = item.ExpandItemName()
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

	wideFrame, err := data.LongToWide(frame, &data.FillMissing{Mode: data.FillModeNull})
	if err != nil {
		backend.Logger.Debug("Error converting data frame to the wide format", "error", err)
		return frame
	}
	return wideFrame
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
