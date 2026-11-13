package datasource

import (
	"encoding/json"
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const apmSec = int64(time.Second)

// apmPoint builds a data point at second ts for a series started at second 0+1.
func apmPoint(typ int, ts int64, value float64, attrs zabbix.APMAttributes) zabbix.APMMetricPoint {
	return zabbix.APMMetricPoint{
		Type:                   typ,
		ServiceName:            "checkout",
		MetricName:             "m",
		ResourceAttributes:     zabbix.APMAttributes{"service.name": "checkout"},
		Attributes:             attrs,
		StartTimeUnix:          1 * apmSec,
		TimeUnix:               ts * apmSec,
		Value:                  value,
		AggregationTemporality: zabbix.APMTemporalityCumulative,
	}
}

func sampleValues(samples []apmSample) []float64 {
	values := make([]float64, 0, len(samples))
	for _, s := range samples {
		values = append(values, s.value)
	}
	return values
}

func TestBuildAPMSeriesGauge(t *testing.T) {
	points := []zabbix.APMMetricPoint{
		apmPoint(zabbix.APMMetricTypeGauge, 10, 1, zabbix.APMAttributes{"state": "used"}),
		apmPoint(zabbix.APMMetricTypeGauge, 10, 5, zabbix.APMAttributes{"state": "free"}),
		apmPoint(zabbix.APMMetricTypeGauge, 20, 2, zabbix.APMAttributes{"state": "used"}),
	}
	// A data point without a recorded value is skipped
	noValue := apmPoint(zabbix.APMMetricTypeGauge, 30, 0, zabbix.APMAttributes{"state": "used"})
	noValue.Flags = zabbix.APMFlagNoRecordedValue
	points = append(points, noValue)

	series := buildAPMSeries(points, "")
	require.Len(t, series, 2)

	assert.Equal(t, apmKindInstant, series[0].kind)
	assert.Equal(t, map[string]string{"service.name": "checkout", "state": "used"}, series[0].labels)
	assert.Equal(t, []float64{1, 2}, sampleValues(series[0].samples))
	assert.Equal(t, []float64{5}, sampleValues(series[1].samples))
}

func TestBuildAPMSeriesCumulativeSum(t *testing.T) {
	monotonic := func(ts int64, value float64) zabbix.APMMetricPoint {
		p := apmPoint(zabbix.APMMetricTypeSum, ts, value, nil)
		p.IsMonotonic = true
		return p
	}
	points := []zabbix.APMMetricPoint{monotonic(10, 100), monotonic(20, 150), monotonic(30, 250)}
	// Counter reset: the process restarted at second 32 and counted 30 by second 40
	reset := monotonic(40, 30)
	reset.StartTimeUnix = 32 * apmSec
	points = append(points, reset)

	t.Run("auto returns the rate of a monotonic sum", func(t *testing.T) {
		series := buildAPMSeries(points, apmSumModeAuto)
		require.Len(t, series, 1)
		assert.Equal(t, apmKindRate, series[0].kind)
		assert.InDeltaSlice(t, []float64{5, 10, 3.75}, sampleValues(series[0].samples), 1e-9)
	})

	t.Run("increase", func(t *testing.T) {
		series := buildAPMSeries(points, apmSumModeIncrease)
		assert.Equal(t, apmKindIncrease, series[0].kind)
		assert.Equal(t, []float64{50, 100, 30}, sampleValues(series[0].samples))
	})

	t.Run("raw", func(t *testing.T) {
		series := buildAPMSeries(points, apmSumModeRaw)
		assert.Equal(t, apmKindInstant, series[0].kind)
		assert.Equal(t, []float64{100, 150, 250, 30}, sampleValues(series[0].samples))
	})

	t.Run("a decreasing monotonic sum without a new start time is a reset too", func(t *testing.T) {
		series := buildAPMSeries([]zabbix.APMMetricPoint{monotonic(10, 100), monotonic(20, 40)}, apmSumModeIncrease)
		assert.Equal(t, []float64{40}, sampleValues(series[0].samples))
	})

	t.Run("auto returns a non-monotonic sum as-is", func(t *testing.T) {
		upDown := []zabbix.APMMetricPoint{
			apmPoint(zabbix.APMMetricTypeSum, 10, 4, nil),
			apmPoint(zabbix.APMMetricTypeSum, 20, 2, nil),
		}
		series := buildAPMSeries(upDown, apmSumModeAuto)
		assert.Equal(t, apmKindInstant, series[0].kind)
		assert.Equal(t, []float64{4, 2}, sampleValues(series[0].samples))
	})
}

func TestBuildAPMSeriesDeltaSum(t *testing.T) {
	delta := func(start, ts int64, value float64) zabbix.APMMetricPoint {
		p := apmPoint(zabbix.APMMetricTypeSum, ts, value, nil)
		p.IsMonotonic = true
		p.AggregationTemporality = zabbix.APMTemporalityDelta
		p.StartTimeUnix = start * apmSec
		return p
	}
	points := []zabbix.APMMetricPoint{delta(5, 10, 50), delta(10, 20, 20)}

	rate := buildAPMSeries(points, apmSumModeRate)
	// The first delta point is usable: its own interval is known
	assert.InDeltaSlice(t, []float64{10, 2}, sampleValues(rate[0].samples), 1e-9)

	increase := buildAPMSeries(points, apmSumModeIncrease)
	assert.Equal(t, []float64{50, 20}, sampleValues(increase[0].samples))
}

func TestAPMHistogramQuantile(t *testing.T) {
	hist := apmHist{bounds: []float64{1, 2, 4}, counts: []float64{10, 20, 10, 0}}
	buckets := hist.buckets()

	// 40 measurements: rank 20 falls in the middle of (1, 2]
	assert.InDelta(t, 1.5, *apmHistogramQuantile(0.5, buckets), 1e-9)
	// The first bucket of non-negative measurements starts at 0
	assert.InDelta(t, 0.4, *apmHistogramQuantile(0.1, buckets), 1e-9)
	assert.InDelta(t, 4, *apmHistogramQuantile(1, buckets), 1e-9)

	// A quantile in the overflow bucket is the highest finite bound
	overflow := apmHist{bounds: []float64{1, 2}, counts: []float64{0, 1, 9}}
	assert.InDelta(t, 2, *apmHistogramQuantile(0.99, overflow.buckets()), 1e-9)

	assert.Nil(t, apmHistogramQuantile(0.5, apmHist{bounds: []float64{1}, counts: []float64{0, 0}}.buckets()))
}

func TestAPMHistSub(t *testing.T) {
	t.Run("explicit buckets", func(t *testing.T) {
		prev := apmHist{count: 10, sum: 5, bounds: []float64{1, 2}, counts: []float64{4, 4, 2}}
		cur := apmHist{count: 16, sum: 9, bounds: []float64{1, 2}, counts: []float64{6, 7, 3}}

		delta, ok := cur.sub(prev)
		require.True(t, ok)
		assert.Equal(t, []float64{2, 3, 1}, delta.counts)
		assert.Equal(t, 6.0, delta.count)
		assert.Equal(t, 4.0, delta.sum)

		_, ok = prev.sub(cur)
		assert.False(t, ok, "a lower count is a reset")

		other := apmHist{count: 20, bounds: []float64{1, 3}, counts: []float64{6, 7, 7}}
		_, ok = other.sub(prev)
		assert.False(t, ok, "changed bounds are a reset")
	})

	t.Run("exponential buckets are downscaled to a common scale", func(t *testing.T) {
		// Scale 1: base sqrt(2). Indexes 0 and 1 merge into index 0 of scale 0 (1, 2].
		prev := apmHist{exponential: true, scale: 1, count: 3, positive: map[int]float64{0: 1, 1: 2}}
		cur := apmHist{exponential: true, scale: 0, count: 8, positive: map[int]float64{0: 5, 1: 3}}

		delta, ok := cur.sub(prev)
		require.True(t, ok)
		assert.Equal(t, 0, delta.scale)
		assert.Equal(t, map[int]float64{0: 2, 1: 3}, delta.positive)

		buckets := delta.buckets()
		require.Len(t, buckets, 2)
		assert.InDelta(t, 1, buckets[0].lower, 1e-9)
		assert.InDelta(t, 2, buckets[0].upper, 1e-9)
		assert.InDelta(t, 4, buckets[1].upper, 1e-9)
	})

	t.Run("exponential bucket bounds", func(t *testing.T) {
		hist := apmHist{exponential: true, scale: 2, zero: 1, positive: map[int]float64{-4: 2}, negative: map[int]float64{0: 3}}
		buckets := hist.buckets()
		require.Len(t, buckets, 3)
		// Negative bucket first, then the zero bucket, then (2^-1, 2^-0.75]
		assert.InDelta(t, -math.Pow(2, 0.25), buckets[0].lower, 1e-9)
		assert.InDelta(t, -1, buckets[0].upper, 1e-9)
		assert.Equal(t, apmBucket{lower: 0, upper: 0, count: 1}, buckets[1])
		assert.InDelta(t, 0.5, buckets[2].lower, 1e-9)
		assert.InDelta(t, math.Pow(2, -0.75), buckets[2].upper, 1e-9)
	})
}

func apmHistPoint(ts int64, counts []float64, sum float64) zabbix.APMMetricPoint {
	p := apmPoint(zabbix.APMMetricTypeHistogram, ts, 0, nil)
	p.ExplicitBounds = []float64{1, 2}
	p.BucketCounts = counts
	for _, c := range counts {
		p.Count += c
	}
	p.Sum = sum
	return p
}

func TestFinalizeAPMHistogram(t *testing.T) {
	points := []zabbix.APMMetricPoint{
		apmHistPoint(10, []float64{0, 0, 0}, 0),
		apmHistPoint(20, []float64{10, 10, 0}, 20),
		apmHistPoint(30, []float64{10, 30, 0}, 50),
	}
	series := buildAPMSeries(points, "")
	require.Len(t, series, 1)
	require.Equal(t, apmKindHistogram, series[0].kind)

	t.Run("quantiles", func(t *testing.T) {
		result := finalizeAPMSeries(series, "", []float64{0.5, 1})
		require.Len(t, result, 2)
		assert.Equal(t, "0.5", result[0].Meta.Labels[apmLabelQuantile])
		assert.Equal(t, "checkout", result[0].Meta.Labels["service.name"])
		// Second 20: 10 in (0,1], 10 in (1,2] -> median 1. Second 30: 20 more in (1,2] -> 1.5
		assert.InDelta(t, 1, *result[0].TS[0].Value, 1e-9)
		assert.InDelta(t, 1.5, *result[0].TS[1].Value, 1e-9)
		assert.Equal(t, "1", result[1].Meta.Labels[apmLabelQuantile])
	})

	t.Run("average", func(t *testing.T) {
		result := finalizeAPMSeries(series, apmHistogramModeAverage, nil)
		require.Len(t, result, 1)
		assert.InDelta(t, 1, *result[0].TS[0].Value, 1e-9)
		assert.InDelta(t, 1.5, *result[0].TS[1].Value, 1e-9)
	})

	t.Run("count rate", func(t *testing.T) {
		result := finalizeAPMSeries(series, apmHistogramModeCount, nil)
		require.Len(t, result, 1)
		assert.Equal(t, "cps", result[0].Meta.Unit)
		assert.InDelta(t, 2, *result[0].TS[0].Value, 1e-9)
		assert.InDelta(t, 2, *result[0].TS[1].Value, 1e-9)
	})

	t.Run("buckets", func(t *testing.T) {
		result := finalizeAPMSeries(series, apmHistogramModeBuckets, nil)
		require.Len(t, result, 3)
		assert.Equal(t, "1", result[0].Meta.Labels[apmLabelBucket])
		assert.Equal(t, "2", result[1].Meta.Labels[apmLabelBucket])
		assert.Equal(t, "+Inf", result[2].Meta.Labels[apmLabelBucket])
		assert.Equal(t, 10.0, *result[1].TS[0].Value)
		assert.Equal(t, 20.0, *result[1].TS[1].Value)
		assert.True(t, result[1].Meta.Additive)
	})
}

func TestGroupAPMSeries(t *testing.T) {
	step := 10 * time.Second

	t.Run("gauges are aggregated on a common time grid", func(t *testing.T) {
		points := []zabbix.APMMetricPoint{
			apmPoint(zabbix.APMMetricTypeGauge, 10, 1, zabbix.APMAttributes{"host": "a", "state": "used"}),
			apmPoint(zabbix.APMMetricTypeGauge, 13, 10, zabbix.APMAttributes{"host": "b", "state": "used"}),
			apmPoint(zabbix.APMMetricTypeGauge, 20, 2, zabbix.APMAttributes{"host": "a", "state": "used"}),
			apmPoint(zabbix.APMMetricTypeGauge, 23, 20, zabbix.APMAttributes{"host": "b", "state": "used"}),
		}

		grouped := groupAPMSeries(buildAPMSeries(points, ""), []string{"state"}, "sum", step)
		require.Len(t, grouped, 1)
		assert.Equal(t, map[string]string{"state": "used"}, grouped[0].labels)
		// Second 10: only a. Second 20: a=2 plus the last value of b (10). Second 30: 2+20.
		assert.Equal(t, []float64{1, 12, 22}, sampleValues(grouped[0].samples))

		avg := groupAPMSeries(buildAPMSeries(points, ""), []string{"state"}, "avg", step)
		assert.Equal(t, []float64{1, 6, 11}, sampleValues(avg[0].samples))

		max := groupAPMSeries(buildAPMSeries(points, ""), []string{"state"}, "max", step)
		assert.Equal(t, []float64{1, 10, 20}, sampleValues(max[0].samples))
	})

	t.Run("increases are conserved when resampled", func(t *testing.T) {
		counter := func(ts int64, value float64, host string) zabbix.APMMetricPoint {
			p := apmPoint(zabbix.APMMetricTypeSum, ts, value, zabbix.APMAttributes{"host": host})
			p.IsMonotonic = true
			return p
		}
		points := []zabbix.APMMetricPoint{
			counter(0, 0, "a"), counter(5, 10, "a"), counter(10, 20, "a"), counter(15, 30, "a"), counter(20, 40, "a"),
			counter(0, 0, "b"), counter(20, 100, "b"),
		}

		increase := groupAPMSeries(buildAPMSeries(points, apmSumModeIncrease), []string{"service.name"}, "sum", step)
		require.Len(t, increase, 1)
		// a: 20 per step. b: 100 over 20 s, spread evenly over both steps.
		assert.InDeltaSlice(t, []float64{70, 70}, sampleValues(increase[0].samples), 1e-9)

		rate := groupAPMSeries(buildAPMSeries(points, apmSumModeRate), []string{"service.name"}, "sum", step)
		assert.InDeltaSlice(t, []float64{7, 7}, sampleValues(rate[0].samples), 1e-9)
	})

	t.Run("histograms are merged bucket by bucket", func(t *testing.T) {
		a := []zabbix.APMMetricPoint{apmHistPoint(0, []float64{0, 0, 0}, 0), apmHistPoint(10, []float64{10, 0, 0}, 5)}
		b := []zabbix.APMMetricPoint{apmHistPoint(0, []float64{0, 0, 0}, 0), apmHistPoint(10, []float64{0, 10, 0}, 15)}
		for i := range b {
			b[i].Attributes = zabbix.APMAttributes{"host": "b"}
		}

		grouped := groupAPMSeries(buildAPMSeries(append(a, b...), ""), []string{"service.name"}, "sum", step)
		require.Len(t, grouped, 1)
		require.Len(t, grouped[0].samples, 1)
		sample := grouped[0].samples[0]
		assert.Equal(t, 20.0, sample.count)
		assert.InDelta(t, 1, *apmHistogramQuantile(0.5, sample.buckets), 1e-9)
		assert.InDelta(t, 2, sample.countRate, 1e-9)
	})
}

func TestNameAPMSeries(t *testing.T) {
	build := func() []zabbix.APMMetricPoint {
		return []zabbix.APMMetricPoint{
			apmPoint(zabbix.APMMetricTypeGauge, 10, 1, zabbix.APMAttributes{"state": "used"}),
			apmPoint(zabbix.APMMetricTypeGauge, 10, 5, zabbix.APMAttributes{"state": "free"}),
		}
	}

	t.Run("default name shows only the labels that differ", func(t *testing.T) {
		series := finalizeAPMSeries(buildAPMSeries(build(), ""), "", nil)
		nameAPMSeries(series, "")
		assert.Equal(t, `m {state="used"}`, series[0].Meta.Name)
		assert.Equal(t, `m {state="free"}`, series[1].Meta.Name)
	})

	t.Run("a single series is named after the metric", func(t *testing.T) {
		series := finalizeAPMSeries(buildAPMSeries(build()[:1], ""), "", nil)
		nameAPMSeries(series, "")
		assert.Equal(t, "m", series[0].Meta.Name)
	})

	t.Run("legend template", func(t *testing.T) {
		series := finalizeAPMSeries(buildAPMSeries(build(), ""), "", nil)
		nameAPMSeries(series, "{{__name__}}: {{ service.name }}/{{state}}{{missing}}")
		assert.Equal(t, "m: checkout/used", series[0].Meta.Name)
	})
}

func TestParseAPMQuantiles(t *testing.T) {
	quantiles, err := parseAPMQuantiles("")
	require.NoError(t, err)
	assert.Equal(t, []float64{0.5, 0.95, 0.99}, quantiles)

	quantiles, err = parseAPMQuantiles("0.9; 99")
	require.NoError(t, err)
	assert.Equal(t, []float64{0.9, 0.99}, quantiles)

	_, err = parseAPMQuantiles("p95")
	assert.Error(t, err)
}

func TestAPMGrafanaUnit(t *testing.T) {
	assert.Equal(t, "s", apmGrafanaUnit("s", false))
	assert.Equal(t, "bytes", apmGrafanaUnit("By", false))
	assert.Equal(t, "binBps", apmGrafanaUnit("By", true))
	assert.Equal(t, "reqps", apmGrafanaUnit("{request}", true))
	assert.Equal(t, "cps", apmGrafanaUnit("", true))
	assert.Equal(t, "short", apmGrafanaUnit("{request}", false))
	assert.Equal(t, "", apmGrafanaUnit("furlong", false))
}

func newAPMTestDatasource(t *testing.T, version string, result string, calls *int) *ZabbixDatasourceInstance {
	t.Helper()
	client := zabbix.NewZabbixClientWithHandler(t, func(payload zabbix.ApiRequestPayload) string {
		if payload.Method == "apiinfo.version" {
			return fmt.Sprintf(`{"result":%q}`, version)
		}
		if calls != nil {
			*calls++
		}
		return fmt.Sprintf(`{"result":%s}`, result)
	})
	return &ZabbixDatasourceInstance{
		dsInfo:   basicDatasourceInfo,
		zabbix:   client,
		Settings: &settings.ZabbixDatasourceSettings{},
		logger:   log.New(),
	}
}

func apmTestQuery(apm APMMetricQueryModel) *QueryModel {
	return &QueryModel{
		QueryType:     MODE_METRICS,
		MetricsSource: MetricsSourceAPM,
		APMMetric:     apm,
		TimeRange:     backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(100, 0)},
		Interval:      10 * time.Second,
		MaxDataPoints: 1000,
	}
}

func TestQueryAPMMetrics(t *testing.T) {
	points := []zabbix.APMMetricPoint{
		apmPoint(zabbix.APMMetricTypeGauge, 20, 2, zabbix.APMAttributes{"state": "used"}),
		apmPoint(zabbix.APMMetricTypeGauge, 20, 6, zabbix.APMAttributes{"state": "free"}),
		apmPoint(zabbix.APMMetricTypeGauge, 10, 1, zabbix.APMAttributes{"state": "used"}),
		apmPoint(zabbix.APMMetricTypeGauge, 10, 7, zabbix.APMAttributes{"state": "free"}),
	}
	for i := range points {
		points[i].MetricUnit = "By"
	}
	// apmmetric.get is asked for the newest points first
	body, err := json.Marshal(points)
	require.NoError(t, err)

	t.Run("returns one labelled frame per attribute set", func(t *testing.T) {
		ds := newAPMTestDatasource(t, "8.0.0", string(body), nil)
		frames, err := ds.queryAPMMetrics(t.Context(), apmTestQuery(APMMetricQueryModel{Metric: "m"}))
		require.NoError(t, err)
		require.Len(t, frames, 2)

		// Series are sorted by their labels
		free := frames[0].Fields[1]
		assert.Equal(t, `m {state="free"}`, free.Config.DisplayNameFromDS)
		assert.Equal(t, "bytes", free.Config.Unit)
		assert.Equal(t, "free", free.Labels["state"])
		assert.Equal(t, "checkout", free.Labels["service.name"])
		require.Equal(t, 2, free.Len())
		assert.Equal(t, 7.0, *free.At(0).(*float64))
		assert.Equal(t, time.Unix(10, 0), frames[0].Fields[0].At(0).(time.Time))
		assert.Nil(t, frames[0].Meta)
	})

	t.Run("warns when the point limit cuts the result", func(t *testing.T) {
		ds := newAPMTestDatasource(t, "8.0.0", string(body), nil)
		frames, err := ds.queryAPMMetrics(t.Context(), apmTestQuery(APMMetricQueryModel{Metric: "m", MaxPoints: 3}))
		require.NoError(t, err)
		require.NotEmpty(t, frames)
		require.NotNil(t, frames[0].Meta)
		require.Len(t, frames[0].Meta.Notices, 1)
		assert.Contains(t, frames[0].Meta.Notices[0].Text, "newest 3")
	})

	t.Run("requires Zabbix 8.0", func(t *testing.T) {
		calls := 0
		ds := newAPMTestDatasource(t, "7.0.0", "[]", &calls)
		_, err := ds.queryAPMMetrics(t.Context(), apmTestQuery(APMMetricQueryModel{Metric: "m"}))
		require.ErrorIs(t, err, ErrAPMNotSupported)
		assert.True(t, backend.IsDownstreamError(err))
		assert.Zero(t, calls)
	})

	t.Run("an incomplete query returns nothing without calling Zabbix", func(t *testing.T) {
		calls := 0
		ds := newAPMTestDatasource(t, "8.0.0", "[]", &calls)
		frames, err := ds.queryAPMMetrics(t.Context(), apmTestQuery(APMMetricQueryModel{}))
		require.NoError(t, err)
		assert.Empty(t, frames)
		assert.Zero(t, calls)
	})

	t.Run("rejects invalid quantiles", func(t *testing.T) {
		ds := newAPMTestDatasource(t, "8.0.0", "[]", nil)
		_, err := ds.queryAPMMetrics(t.Context(), apmTestQuery(APMMetricQueryModel{Metric: "m", Quantiles: "high"}))
		require.Error(t, err)
		assert.True(t, backend.IsDownstreamError(err))
	})
}

func TestReadQueryAPMMetrics(t *testing.T) {
	query, err := ReadQuery(backend.DataQuery{
		RefID:     "A",
		QueryType: MODE_METRICS,
		JSON: []byte(`{
			"queryType": "0",
			"metricsSource": "apm",
			"apmMetric": {
				"service": "checkout",
				"metric": "http.server.request.duration",
				"attributes": [{"scope": "resource", "key": "host.name", "value": "web-1", "operator": 1}],
				"histogramMode": "quantiles",
				"quantiles": "0.9",
				"groupBy": ["http.route"],
				"aggregation": "avg",
				"maxPoints": 1000
			}
		}`),
	})
	require.NoError(t, err)
	assert.Equal(t, MetricsSourceAPM, query.MetricsSource)
	assert.Equal(t, "http.server.request.duration", query.APMMetric.Metric)
	assert.Equal(t, []APMAttributeFilterModel{{Scope: "resource", Key: "host.name", Value: "web-1", Operator: 1}}, query.APMMetric.Attributes)
	assert.Equal(t, []string{"http.route"}, query.APMMetric.GroupBy)
	assert.Equal(t, 1000, query.APMMetric.MaxPoints)
}
