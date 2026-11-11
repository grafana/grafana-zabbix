package timeseries

import (
	"encoding/json"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
)

type TimePoint struct {
	Time  time.Time
	Value *float64
}

func (p *TimePoint) UnmarshalJSON(data []byte) error {
	point := &struct {
		Time  int64
		Value *float64
	}{}

	if err := json.Unmarshal(data, &point); err != nil {
		return err
	}

	p.Value = point.Value
	p.Time = time.Unix(point.Time, 0)

	return nil
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

	// Item update interval. nil means not supported intervals (flexible, schedule, etc)
	Interval *time.Duration

	// AggValue is using for sorting purposes
	AggValue *float64

	// Labels are the dimensions of a series that does not come from a Zabbix item
	// (APM/OpenTelemetry metrics). They become the labels of the data frame field.
	Labels map[string]string
	// Unit is the Grafana unit id of such a series.
	Unit string
	// Additive marks series whose values add up over time (increases, bucket counts),
	// so they are downsampled with sum instead of avg.
	Additive bool
}

type AggFunc = func(points []TimePoint) *float64

type TransformFunc = func(point TimePoint) TimePoint
