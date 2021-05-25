package timeseries

import (
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
)

type TimePoint struct {
	Time  time.Time
	Value *float64
}

type TimeSeries []TimePoint

func NewTimeSeries() TimeSeries {
	return make(TimeSeries, 0)
}

func (ts *TimeSeries) Len() int {
	return len(*ts)
}

type TimeSeriesData struct {
	TS   TimeSeries
	Meta TimeSeriesMeta
}

type TimeSeriesMeta struct {
	Name string
	Item *zabbix.Item
}

type AggFunc = func(points []TimePoint) *float64

type TransformFunc = func(point TimePoint) TimePoint
