package datasource

import (
	"fmt"
	"strconv"
	"time"

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
			pointSeries.Meta.Item = pointItem
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

	return series
}

func convertTimeSeriesToDataFrame(series []*timeseries.TimeSeriesData) *data.Frame {
	timeFileld := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeFileld.Name = "time"
	frame := data.NewFrame("History", timeFileld)

	for _, s := range series {
		field := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)
		item := s.Meta.Item
		if len(item.Hosts) > 0 {
			field.Name = fmt.Sprintf("%s: %s", item.Hosts[0].Name, item.ExpandItemName())
		} else {
			field.Name = item.ExpandItemName()
		}

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
		valueStr := point.ValueAvg
		switch valueType {
		case "min":
			valueStr = point.ValueMin
		case "max":
			valueStr = point.ValueMax
		}

		value, err := strconv.ParseFloat(valueStr, 64)
		if err != nil {
			return nil, fmt.Errorf("error parsing trend value: %s", err)
		}

		history = append(history, zabbix.HistoryPoint{
			ItemID: point.ItemID,
			Clock:  point.Clock,
			Value:  value,
		})
	}

	return history, nil
}
