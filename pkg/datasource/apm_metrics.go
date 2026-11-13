package datasource

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	// MetricsSourceItem queries Zabbix items (the default, also when the field is absent).
	MetricsSourceItem = "item"
	// MetricsSourceAPM queries APM (OpenTelemetry) metrics, Zabbix 8.0+.
	MetricsSourceAPM = "apm"

	// APMMinZabbixVersion is the first Zabbix version (major*10+minor) with apmmetric.get.
	APMMinZabbixVersion = 80

	// DefaultAPMMaxPoints is how many raw data points one APM metrics query fetches by default.
	// apmmetric.get cannot downsample, so the plugin has to bound the response itself.
	DefaultAPMMaxPoints = 50000
	// MaxAPMMaxPoints is the ceiling for the per-query data point limit.
	MaxAPMMaxPoints = 500000
	// MaxAPMSeries is the maximum number of series one APM metrics query may return.
	MaxAPMSeries = 1000

	// apmGaugeLookback is how long the last value of a gauge stays valid when series are grouped.
	apmGaugeLookback = 5 * time.Minute

	apmSumModeAuto     = "auto"
	apmSumModeRate     = "rate"
	apmSumModeIncrease = "increase"
	apmSumModeRaw      = "raw"

	apmHistogramModeQuantiles = "quantiles"
	apmHistogramModeAverage   = "average"
	apmHistogramModeCount     = "count"
	apmHistogramModeBuckets   = "buckets"

	apmDefaultQuantiles = "0.5, 0.95, 0.99"

	apmLabelQuantile = "quantile"
	apmLabelBucket   = "le"
)

var (
	ErrAPMNotSupported  = errors.New("APM metrics require Zabbix 8.0 or higher")
	ErrAPMTooManySeries = fmt.Errorf("APM metrics query matches more than %d series, narrow it with attribute filters or group the series by fewer labels", MaxAPMSeries)
)

// APMMetricQueryModel is the APM part of a Metrics query (metricsSource "apm").
type APMMetricQueryModel struct {
	// Exact service name. "a|b" matches several (multi-value variables). Empty means any service.
	Service string `json:"service"`
	// Exact metric name. "a|b" matches several.
	Metric     string                    `json:"metric"`
	Attributes []APMAttributeFilterModel `json:"attributes"`

	// How Sum metrics are returned: auto (rate for monotonic sums, raw otherwise), rate, increase or raw.
	SumMode string `json:"sumMode"`
	// How Histogram metrics are returned: quantiles, average, count or buckets.
	HistogramMode string `json:"histogramMode"`
	// Comma-separated quantiles (0..1) for the quantiles histogram mode.
	Quantiles string `json:"quantiles"`

	// Labels to keep when aggregating series. Empty means no aggregation.
	GroupBy []string `json:"groupBy"`
	// Aggregation across grouped gauge and sum series: sum, avg, min or max.
	Aggregation string `json:"aggregation"`

	// Legend template, e.g. "{{service.name}} {{http.route}}".
	Legend string `json:"legend"`
	// Maximum number of raw data points to fetch.
	MaxPoints int `json:"maxPoints"`
}

// APMAttributeFilterModel is one attribute condition of the query editor.
type APMAttributeFilterModel struct {
	// Attribute scope: "metric" (data point attributes), "resource" or "scope".
	Scope    string `json:"scope"`
	Key      string `json:"key"`
	Value    string `json:"value"`
	Operator int    `json:"operator"`
}

type apmSeriesKind int

const (
	// Point-in-time values: gauges and sums returned as-is
	apmKindInstant apmSeriesKind = iota
	// Per-second rate of a sum
	apmKindRate
	// Increase of a sum over the interval between two data points
	apmKindIncrease
	// Histogram measurements recorded over the interval between two data points
	apmKindHistogram
)

// apmSample is one value of a series. Rate, increase and histogram samples
// describe the interval (t-dt, t]; instant samples have no interval.
type apmSample struct {
	t  time.Time
	dt time.Duration

	// Instant value, per-second rate or increase, depending on the series kind
	value float64

	// Histogram kind
	buckets []apmBucket
	count   float64
	sum     float64
	// Measurements per second
	countRate float64
}

type apmSeries struct {
	kind    apmSeriesKind
	metric  string
	unit    string
	labels  map[string]string
	samples []apmSample
}

func (ds *ZabbixDatasourceInstance) queryAPMMetrics(ctx context.Context, query *QueryModel) ([]*data.Frame, error) {
	apmQuery := query.APMMetric
	metrics := zabbix.SplitAPMNames(apmQuery.Metric)
	if len(metrics) == 0 {
		// The query is not complete yet
		return []*data.Frame{}, nil
	}

	version, err := ds.zabbix.GetVersion(ctx)
	if err != nil {
		return nil, err
	}
	if version < APMMinZabbixVersion {
		return nil, backend.DownstreamError(ErrAPMNotSupported)
	}

	quantiles, err := parseAPMQuantiles(apmQuery.Quantiles)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}

	// timeShift() moves the query time range
	if err := applyFunctionsPre(query, nil); err != nil {
		return nil, err
	}

	maxPoints := apmQuery.MaxPoints
	if maxPoints <= 0 {
		maxPoints = DefaultAPMMaxPoints
	}
	if maxPoints > MaxAPMMaxPoints {
		maxPoints = MaxAPMMaxPoints
	}

	request := zabbix.APMMetricsQuery{
		Services: zabbix.SplitAPMNames(apmQuery.Service),
		Metrics:  metrics,
		Limit:    maxPoints,
	}
	for _, f := range apmQuery.Attributes {
		if strings.TrimSpace(f.Key) == "" {
			continue
		}
		filter := zabbix.APMAttributeFilter{Key: f.Key, Value: f.Value, Operator: f.Operator}
		switch f.Scope {
		case "resource":
			request.ResourceAttributes = append(request.ResourceAttributes, filter)
		case "scope":
			request.ScopeAttributes = append(request.ScopeAttributes, filter)
		default:
			request.Attributes = append(request.Attributes, filter)
		}
	}

	points, truncated, err := ds.zabbix.GetAPMMetrics(ctx, request, query.TimeRange)
	if err != nil {
		return nil, err
	}

	series := buildAPMSeries(points, apmQuery.SumMode)
	if len(apmQuery.GroupBy) > 0 {
		step := query.Interval
		if step < time.Second {
			step = time.Second
		}
		series = groupAPMSeries(series, apmQuery.GroupBy, apmQuery.Aggregation, step)
	}

	sortAPMSeries(series)

	tsSeries := finalizeAPMSeries(series, apmQuery.HistogramMode, quantiles)
	if len(tsSeries) > MaxAPMSeries {
		return nil, backend.DownstreamError(ErrAPMTooManySeries)
	}
	nameAPMSeries(tsSeries, apmQuery.Legend)

	tsSeries, err = applyFunctions(tsSeries, query.Functions)
	if err != nil {
		return nil, err
	}

	consolidateBy := ds.getConsolidateBy(query)
	for _, s := range tsSeries {
		if int64(s.Len()) > query.MaxDataPoints && query.MaxDataPoints > 0 && query.Interval > 0 {
			downsampleFunc := consolidateBy
			if downsampleFunc == "" {
				downsampleFunc = "avg"
				if s.Meta.Additive {
					// Increases and bucket counts add up over a longer interval
					downsampleFunc = "sum"
				}
			}
			if downsampled, err := applyGroupBy(s.TS, query.Interval.String(), downsampleFunc); err == nil {
				s.TS = downsampled
			} else {
				ds.logger.Debug("Error downsampling APM series", "error", err)
			}
		}
	}

	frames := make([]*data.Frame, 0, len(tsSeries))
	for _, s := range tsSeries {
		frames = append(frames, apmSeriesToDataFrame(s))
	}

	if truncated && len(frames) > 0 {
		frames[0].AppendNotices(data.Notice{
			Severity: data.NoticeSeverityWarning,
			Text: fmt.Sprintf(
				"The query matched more than %d APM data points, only the newest %d are shown. "+
					"Narrow the time range or the filters, or raise the point limit in the query.",
				maxPoints, maxPoints,
			),
		})
	}

	return frames, nil
}

// parseAPMQuantiles parses "0.5, 0.95, 0.99". Values above 1 are read as percentiles (95 -> 0.95).
func parseAPMQuantiles(value string) ([]float64, error) {
	if strings.TrimSpace(value) == "" {
		value = apmDefaultQuantiles
	}

	quantiles := []float64{}
	for _, part := range strings.FieldsFunc(value, func(r rune) bool { return r == ',' || r == ' ' || r == ';' }) {
		q, err := strconv.ParseFloat(part, 64)
		if err != nil || math.IsNaN(q) || q < 0 || q > 100 {
			return nil, fmt.Errorf("invalid quantile %q: use numbers between 0 and 1, for example 0.5, 0.95, 0.99", part)
		}
		if q > 1 {
			q /= 100
		}
		quantiles = append(quantiles, q)
	}
	return quantiles, nil
}

// buildAPMSeries groups data points (sorted by time) into one series per unique
// metric and attribute set, and converts cumulative and delta data points into samples.
func buildAPMSeries(points []zabbix.APMMetricPoint, sumMode string) []*apmSeries {
	type rawSeries struct {
		series *apmSeries
		points []*zabbix.APMMetricPoint
	}

	rawByKey := map[string]*rawSeries{}
	order := []string{}
	for i := range points {
		p := &points[i]
		if p.Flags&zabbix.APMFlagNoRecordedValue != 0 {
			continue
		}
		key := p.SeriesKey()
		raw, ok := rawByKey[key]
		if !ok {
			labels := make(map[string]string, len(p.ResourceAttributes)+len(p.Attributes)+1)
			for k, v := range p.ResourceAttributes {
				labels[k] = v
			}
			for k, v := range p.Attributes {
				labels[k] = v
			}
			if _, exists := labels["service.name"]; !exists && p.ServiceName != "" {
				labels["service.name"] = p.ServiceName
			}
			raw = &rawSeries{series: &apmSeries{metric: p.MetricName, unit: p.MetricUnit, labels: labels}}
			rawByKey[key] = raw
			order = append(order, key)
		}
		raw.points = append(raw.points, p)
	}

	series := make([]*apmSeries, 0, len(order))
	for _, key := range order {
		raw := rawByKey[key]
		s := raw.series
		first := raw.points[0]
		switch first.Type {
		case zabbix.APMMetricTypeHistogram, zabbix.APMMetricTypeExponentialHistogram:
			s.kind = apmKindHistogram
			s.samples = apmHistogramSamples(raw.points)
		case zabbix.APMMetricTypeSum:
			mode := sumMode
			if mode == "" || mode == apmSumModeAuto {
				mode = apmSumModeRaw
				if first.IsMonotonic {
					mode = apmSumModeRate
				}
			}
			switch mode {
			case apmSumModeRate:
				s.kind = apmKindRate
				s.samples = apmSumSamples(raw.points, true)
			case apmSumModeIncrease:
				s.kind = apmKindIncrease
				s.samples = apmSumSamples(raw.points, false)
			default:
				s.kind = apmKindInstant
				s.samples = apmInstantSamples(raw.points)
			}
		default:
			s.kind = apmKindInstant
			s.samples = apmInstantSamples(raw.points)
		}
		if len(s.samples) > 0 {
			series = append(series, s)
		}
	}
	return series
}

// sortAPMSeries orders series by metric name and labels. Data points arrive ordered by
// time, so without it the series order would change between refreshes.
func sortAPMSeries(series []*apmSeries) {
	keys := make(map[*apmSeries]string, len(series))
	for _, s := range series {
		var sb strings.Builder
		sb.WriteString(s.metric)
		for _, k := range sortedKeys(s.labels) {
			sb.WriteByte(0)
			sb.WriteString(k)
			sb.WriteByte(0)
			sb.WriteString(s.labels[k])
		}
		keys[s] = sb.String()
	}
	sort.SliceStable(series, func(i, j int) bool {
		return keys[series[i]] < keys[series[j]]
	})
}

func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func apmInstantSamples(points []*zabbix.APMMetricPoint) []apmSample {
	samples := make([]apmSample, 0, len(points))
	for _, p := range points {
		samples = append(samples, apmSample{t: p.Time(), value: p.Value})
	}
	return samples
}

// apmInterval returns the interval a delta data point covers, or the interval since the
// previous point of a cumulative series (since the series start after a reset).
func apmInterval(p, prev *zabbix.APMMetricPoint, fromStart bool) time.Duration {
	if fromStart && p.StartTimeUnix > 0 && p.StartTimeUnix < p.TimeUnix {
		return time.Duration(p.TimeUnix - p.StartTimeUnix)
	}
	if prev != nil && prev.TimeUnix < p.TimeUnix {
		return time.Duration(p.TimeUnix - prev.TimeUnix)
	}
	return 0
}

// apmIsReset tells whether a cumulative series was restarted between prev and p.
func apmIsReset(p, prev *zabbix.APMMetricPoint) bool {
	return p.StartTimeUnix > prev.StartTimeUnix && p.StartTimeUnix > 0 && prev.StartTimeUnix > 0
}

// apmSumSamples converts Sum data points into increases (or per-second rates) between
// consecutive points. Delta points already hold the increase; cumulative points are
// subtracted, treating a restarted or decreased monotonic sum as a counter reset.
func apmSumSamples(points []*zabbix.APMMetricPoint, rate bool) []apmSample {
	samples := make([]apmSample, 0, len(points))
	var prev *zabbix.APMMetricPoint
	for _, p := range points {
		var increase float64
		var dt time.Duration

		if p.AggregationTemporality == zabbix.APMTemporalityDelta {
			increase = p.Value
			dt = apmInterval(p, prev, true)
		} else {
			if prev == nil {
				prev = p
				continue
			}
			increase = p.Value - prev.Value
			reset := apmIsReset(p, prev) || (p.IsMonotonic && increase < 0)
			if reset {
				increase = p.Value
			}
			dt = apmInterval(p, prev, reset)
		}
		prev = p

		sample := apmSample{t: p.Time(), dt: dt, value: increase}
		if rate {
			if dt <= 0 {
				continue
			}
			sample.value = increase / dt.Seconds()
		}
		samples = append(samples, sample)
	}
	return samples
}

// apmHistogramSamples converts histogram data points into the measurements recorded
// between consecutive points.
func apmHistogramSamples(points []*zabbix.APMMetricPoint) []apmSample {
	samples := make([]apmSample, 0, len(points))
	var prev *zabbix.APMMetricPoint
	var prevHist apmHist
	for _, p := range points {
		hist := apmHistFromPoint(p)
		var delta apmHist
		var dt time.Duration

		if p.AggregationTemporality == zabbix.APMTemporalityDelta {
			delta = hist
			dt = apmInterval(p, prev, true)
		} else {
			if prev == nil {
				prev, prevHist = p, hist
				continue
			}
			var ok bool
			delta, ok = hist.sub(prevHist)
			reset := !ok || apmIsReset(p, prev)
			if reset {
				delta = hist
			}
			dt = apmInterval(p, prev, reset)
		}
		prev, prevHist = p, hist

		sample := apmSample{t: p.Time(), dt: dt, buckets: delta.buckets(), count: delta.count, sum: delta.sum}
		if dt > 0 {
			sample.countRate = delta.count / dt.Seconds()
		}
		samples = append(samples, sample)
	}
	return samples
}

// groupAPMSeries aggregates series that share the values of the groupBy labels.
// Series report at their own times, so they are first resampled to a common time
// grid: a gauge contributes its last value, while rates, increases and histograms
// contribute in proportion to how much of their interval falls into the step.
func groupAPMSeries(series []*apmSeries, groupBy []string, aggregation string, step time.Duration) []*apmSeries {
	type group struct {
		result  *apmSeries
		members []*apmSeries
	}

	groups := map[string]*group{}
	order := []string{}
	for _, s := range series {
		labels := map[string]string{}
		var sb strings.Builder
		sb.WriteString(s.metric)
		sb.WriteByte(0)
		sb.WriteString(strconv.Itoa(int(s.kind)))
		for _, key := range groupBy {
			key = strings.TrimSpace(key)
			if key == "" {
				continue
			}
			value, ok := s.labels[key]
			if ok {
				labels[key] = value
			}
			sb.WriteByte(0)
			sb.WriteString(value)
		}
		key := sb.String()
		g, ok := groups[key]
		if !ok {
			g = &group{result: &apmSeries{kind: s.kind, metric: s.metric, unit: s.unit, labels: labels}}
			groups[key] = g
			order = append(order, key)
		}
		g.members = append(g.members, s)
	}

	result := make([]*apmSeries, 0, len(order))
	for _, key := range order {
		g := groups[key]

		var minT, maxT time.Time
		for _, s := range g.members {
			first, last := s.samples[0].t, s.samples[len(s.samples)-1].t
			if minT.IsZero() || first.Before(minT) {
				minT = first
			}
			if last.After(maxT) {
				maxT = last
			}
		}

		cursors := make([]int, len(g.members))
		start := minT.Truncate(step)
		if start.Before(minT) {
			start = start.Add(step)
		}
		// The last grid point is the first one at or after the newest sample
		for t := start; t.Before(maxT.Add(step)); t = t.Add(step) {
			values := []float64{}
			merged := apmSample{t: t, dt: step}
			contributed := false

			for i, s := range g.members {
				sample, ok := apmSampleAt(s, &cursors[i], t, step)
				if !ok {
					continue
				}
				contributed = true
				if s.kind == apmKindHistogram {
					merged.buckets = mergeAPMBuckets(merged.buckets, sample.buckets, 1)
					merged.count += sample.count
					merged.sum += sample.sum
					merged.countRate += sample.countRate
				} else {
					values = append(values, sample.value)
				}
			}

			if !contributed {
				continue
			}
			if g.result.kind != apmKindHistogram {
				merged.value = aggregateAPMValues(values, aggregation)
			}
			g.result.samples = append(g.result.samples, merged)
		}

		if len(g.result.samples) > 0 {
			result = append(result, g.result)
		}
	}
	return result
}

// apmSampleAt resamples s to the grid step (t-step, t]. A gauge yields its latest value
// at or before t. Rates, increases and histograms describe intervals, so every sample
// contributes the share of its interval that overlaps the step: increases and bucket
// counts add up, rates are averaged over the covered time. cursor is the index of the
// sample the previous step stopped at.
func apmSampleAt(s *apmSeries, cursor *int, t time.Time, step time.Duration) (apmSample, bool) {
	samples := s.samples

	if s.kind == apmKindInstant {
		for *cursor+1 < len(samples) && !samples[*cursor+1].t.After(t) {
			*cursor++
		}
		sample := samples[*cursor]
		if sample.t.After(t) || t.Sub(sample.t) > apmGaugeLookback+step {
			return apmSample{}, false
		}
		return sample, true
	}

	stepStart := t.Add(-step)
	// Skip the samples that end before the step starts
	for *cursor < len(samples) && !samples[*cursor].t.After(stepStart) {
		*cursor++
	}

	result := apmSample{t: t, dt: step}
	covered := time.Duration(0)
	rateSum, countRateSum := 0.0, 0.0
	for i := *cursor; i < len(samples); i++ {
		sample := samples[i]
		dt := sample.dt
		if dt <= 0 {
			// The interval of the first delta data point may be unknown
			dt = step
		}
		sampleStart := sample.t.Add(-dt)
		if !sampleStart.Before(t) {
			break
		}

		overlapStart, overlapEnd := sampleStart, sample.t
		if overlapStart.Before(stepStart) {
			overlapStart = stepStart
		}
		if overlapEnd.After(t) {
			overlapEnd = t
		}
		overlap := overlapEnd.Sub(overlapStart)
		if overlap <= 0 {
			continue
		}
		share := overlap.Seconds() / dt.Seconds()
		covered += overlap

		switch s.kind {
		case apmKindHistogram:
			result.buckets = mergeAPMBuckets(result.buckets, sample.buckets, share)
			result.count += sample.count * share
			result.sum += sample.sum * share
			countRateSum += sample.countRate * overlap.Seconds()
		case apmKindIncrease:
			result.value += sample.value * share
		default:
			rateSum += sample.value * overlap.Seconds()
		}
	}

	if covered <= 0 {
		return apmSample{}, false
	}
	if s.kind == apmKindRate {
		result.value = rateSum / covered.Seconds()
	}
	if s.kind == apmKindHistogram {
		result.countRate = countRateSum / covered.Seconds()
	}
	return result, true
}

func aggregateAPMValues(values []float64, aggregation string) float64 {
	if len(values) == 0 {
		return 0
	}
	result := values[0]
	for _, v := range values[1:] {
		switch aggregation {
		case "min":
			result = math.Min(result, v)
		case "max":
			result = math.Max(result, v)
		default:
			result += v
		}
	}
	if aggregation == "avg" {
		result /= float64(len(values))
	}
	return result
}

// finalizeAPMSeries turns samples into time series. A histogram series becomes one
// series per quantile or per bucket, or a single average or count rate series.
func finalizeAPMSeries(series []*apmSeries, histogramMode string, quantiles []float64) []*timeseries.TimeSeriesData {
	result := make([]*timeseries.TimeSeriesData, 0, len(series))

	newSeries := func(s *apmSeries, unit string, extraLabel, extraValue string) *timeseries.TimeSeriesData {
		ts := timeseries.NewTimeSeriesData()
		ts.Meta.Name = s.metric
		ts.Meta.Unit = unit
		ts.Meta.Labels = make(map[string]string, len(s.labels)+1)
		for k, v := range s.labels {
			ts.Meta.Labels[k] = v
		}
		if extraLabel != "" {
			ts.Meta.Labels[extraLabel] = extraValue
		}
		return ts
	}
	add := func(ts *timeseries.TimeSeriesData, t time.Time, value float64) {
		v := value
		ts.Add(timeseries.TimePoint{Time: t, Value: &v})
	}

	for _, s := range series {
		if s.kind != apmKindHistogram {
			ts := newSeries(s, apmGrafanaUnit(s.unit, s.kind == apmKindRate), "", "")
			ts.Meta.Additive = s.kind == apmKindIncrease
			for _, sample := range s.samples {
				add(ts, sample.t, sample.value)
			}
			result = append(result, ts)
			continue
		}

		switch histogramMode {
		case apmHistogramModeAverage:
			ts := newSeries(s, apmGrafanaUnit(s.unit, false), "", "")
			for _, sample := range s.samples {
				if sample.count > 0 {
					add(ts, sample.t, sample.sum/sample.count)
				}
			}
			result = append(result, ts)

		case apmHistogramModeCount:
			ts := newSeries(s, "cps", "", "")
			for _, sample := range s.samples {
				if sample.dt > 0 {
					add(ts, sample.t, sample.countRate)
				}
			}
			result = append(result, ts)

		case apmHistogramModeBuckets:
			uppers := []float64{}
			seen := map[float64]bool{}
			for _, sample := range s.samples {
				for _, b := range sample.buckets {
					if !seen[b.upper] {
						seen[b.upper] = true
						uppers = append(uppers, b.upper)
					}
				}
			}
			sort.Float64s(uppers)
			for _, upper := range uppers {
				ts := newSeries(s, "short", apmLabelBucket, formatAPMBound(upper))
				ts.Meta.Additive = true
				for _, sample := range s.samples {
					count := 0.0
					for _, b := range sample.buckets {
						if b.upper == upper {
							count = b.count
							break
						}
					}
					add(ts, sample.t, count)
				}
				result = append(result, ts)
			}

		default:
			for _, q := range quantiles {
				ts := newSeries(s, apmGrafanaUnit(s.unit, false), apmLabelQuantile, strconv.FormatFloat(q, 'g', -1, 64))
				for _, sample := range s.samples {
					if value := apmHistogramQuantile(q, sample.buckets); value != nil {
						add(ts, sample.t, *value)
					}
				}
				result = append(result, ts)
			}
		}
	}

	nonEmpty := result[:0]
	for _, ts := range result {
		if ts.Len() > 0 {
			nonEmpty = append(nonEmpty, ts)
		}
	}
	return nonEmpty
}

func formatAPMBound(bound float64) string {
	if math.IsInf(bound, 1) {
		return "+Inf"
	}
	return strconv.FormatFloat(bound, 'g', 6, 64)
}

var apmLegendRegex = regexp.MustCompile(`\{\{\s*([^{}]+?)\s*\}\}`)

// nameAPMSeries sets the display name of every series: the legend template when given
// ({{label}} placeholders, {{__name__}} for the metric name), otherwise the metric name
// followed by the labels that tell the returned series apart.
func nameAPMSeries(series []*timeseries.TimeSeriesData, legend string) {
	if strings.TrimSpace(legend) != "" {
		for _, s := range series {
			metric := s.Meta.Name
			s.Meta.Name = apmLegendRegex.ReplaceAllStringFunc(legend, func(match string) string {
				label := apmLegendRegex.FindStringSubmatch(match)[1]
				if label == "__name__" {
					return metric
				}
				return s.Meta.Labels[label]
			})
		}
		return
	}

	// Labels whose value is not the same in every series
	varying := map[string]bool{}
	if len(series) > 1 {
		first := series[0].Meta.Labels
		for _, s := range series[1:] {
			for k, v := range s.Meta.Labels {
				if fv, ok := first[k]; !ok || fv != v {
					varying[k] = true
				}
			}
			for k := range first {
				if _, ok := s.Meta.Labels[k]; !ok {
					varying[k] = true
				}
			}
		}
	}

	for _, s := range series {
		parts := []string{}
		for _, k := range sortedKeys(s.Meta.Labels) {
			if varying[k] {
				parts = append(parts, fmt.Sprintf("%s=%q", k, s.Meta.Labels[k]))
			}
		}
		if len(parts) > 0 {
			s.Meta.Name = fmt.Sprintf("%s {%s}", s.Meta.Name, strings.Join(parts, ", "))
		}
	}
}

// apmUnits maps OpenTelemetry (UCUM) units to Grafana unit ids.
var apmUnits = map[string]string{
	"s":     "s",
	"ms":    "ms",
	"us":    "µs",
	"ns":    "ns",
	"min":   "m",
	"h":     "h",
	"d":     "d",
	"By":    "bytes",
	"KiBy":  "kbytes",
	"MiBy":  "mbytes",
	"GiBy":  "gbytes",
	"kBy":   "deckbytes",
	"MBy":   "decmbytes",
	"GBy":   "decgbytes",
	"bit":   "bits",
	"By/s":  "binBps",
	"bit/s": "bps",
	"%":     "percent",
	"Hz":    "hertz",
	"Cel":   "celsius",
	"V":     "volt",
	"A":     "amp",
	"W":     "watt",
	"J":     "joule",
}

// apmRateUnits maps units of a sum to the Grafana unit of its per-second rate.
var apmRateUnits = map[string]string{
	"By":        "binBps",
	"bit":       "bps",
	"{request}": "reqps",
}

// apmGrafanaUnit returns the Grafana unit id for an OpenTelemetry unit, or "" when unknown.
func apmGrafanaUnit(unit string, rate bool) string {
	if rate {
		if grafanaUnit, ok := apmRateUnits[unit]; ok {
			return grafanaUnit
		}
		if unit == "" || unit == "1" || strings.HasPrefix(unit, "{") {
			return "cps"
		}
		return ""
	}
	if grafanaUnit, ok := apmUnits[unit]; ok {
		return grafanaUnit
	}
	if unit == "" || unit == "1" || strings.HasPrefix(unit, "{") {
		return "short"
	}
	return ""
}

func apmSeriesToDataFrame(series *timeseries.TimeSeriesData) *data.Frame {
	timeField := data.NewFieldFromFieldType(data.FieldTypeTime, series.Len())
	timeField.Name = data.TimeSeriesTimeFieldName

	valueField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, series.Len())
	valueField.Name = data.TimeSeriesValueFieldName
	if len(series.Meta.Labels) > 0 {
		valueField.Labels = data.Labels(series.Meta.Labels)
	}
	valueField.Config = &data.FieldConfig{
		DisplayNameFromDS: series.Meta.Name,
		Unit:              series.Meta.Unit,
	}

	for i, point := range series.TS {
		timeField.Set(i, point.Time)
		valueField.Set(i, point.Value)
	}

	return data.NewFrame(series.Meta.Name, timeField, valueField)
}
