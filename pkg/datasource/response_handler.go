package datasource

import (
	"fmt"
	"strconv"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func convertHistoryToDataFrame(history zabbix.History, items zabbix.Items) *data.Frame {
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
