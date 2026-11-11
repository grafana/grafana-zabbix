package zabbix

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// APM (OpenTelemetry) metric data point types, as returned by apmmetric.get (Zabbix 8.0+).
const (
	APMMetricTypeGauge                = 0
	APMMetricTypeSum                  = 1
	APMMetricTypeHistogram            = 2
	APMMetricTypeExponentialHistogram = 3
)

// Aggregation temporality of Sum, Histogram and Exponential histogram data points.
const (
	APMTemporalityUnspecified = 0
	APMTemporalityDelta       = 1
	APMTemporalityCumulative  = 2
)

// APMFlagNoRecordedValue is the data point flag meaning that no value was recorded.
const APMFlagNoRecordedValue = 1

// Attribute filter operators of apmmetric.get.
const (
	APMOperatorContains    = 0
	APMOperatorEquals      = 1
	APMOperatorNotContains = 2
	APMOperatorNotEquals   = 3
	APMOperatorExists      = 4
	APMOperatorNotExists   = 5
)

// APMAttributes is a key-value attribute set. Zabbix serializes an empty set as
// `[]` instead of `{}`, and attribute values are always strings.
type APMAttributes map[string]string

func (a *APMAttributes) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		// `[]`, `null` or anything that is not an object: no attributes
		*a = APMAttributes{}
		return nil
	}

	raw := map[string]json.RawMessage{}
	if err := json.Unmarshal(trimmed, &raw); err != nil {
		return err
	}

	attrs := make(APMAttributes, len(raw))
	for key, value := range raw {
		var s string
		if err := json.Unmarshal(value, &s); err == nil {
			attrs[key] = s
		} else {
			attrs[key] = string(value)
		}
	}
	*a = attrs
	return nil
}

// APMMetricPoint is one data point of an APM metric. Only the fields the plugin
// needs for graphing are requested and decoded.
type APMMetricPoint struct {
	Type               int           `json:"type"`
	ServiceName        string        `json:"service_name"`
	MetricName         string        `json:"metric_name"`
	MetricUnit         string        `json:"metric_unit"`
	ScopeName          string        `json:"scope_name"`
	ResourceAttributes APMAttributes `json:"resource_attributes"`
	Attributes         APMAttributes `json:"attributes"`
	// Unix time in nanoseconds
	StartTimeUnix int64 `json:"start_time_unix"`
	TimeUnix      int64 `json:"time_unix"`
	Flags         int   `json:"flags"`

	// Gauge and Sum
	Value                  float64 `json:"value"`
	AggregationTemporality int     `json:"aggregation_temporality"`
	IsMonotonic            bool    `json:"is_monotonic"`

	// Histogram and Exponential histogram
	Count float64 `json:"count"`
	Sum   float64 `json:"sum"`

	// Histogram
	BucketCounts   []float64 `json:"bucket_counts"`
	ExplicitBounds []float64 `json:"explicit_bounds"`

	// Exponential histogram
	Scale                int       `json:"scale"`
	ZeroCount            float64   `json:"zero_count"`
	PositiveOffset       int       `json:"positive_offset"`
	PositiveBucketCounts []float64 `json:"positive_bucket_counts"`
	NegativeOffset       int       `json:"negative_offset"`
	NegativeBucketCounts []float64 `json:"negative_bucket_counts"`
}

// Time returns the data point time.
func (p *APMMetricPoint) Time() time.Time {
	return time.Unix(0, p.TimeUnix)
}

// APMAttributeFilter is a condition on a data point, resource or scope attribute.
type APMAttributeFilter struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Operator int    `json:"operator"`
}

// APMMetricsQuery describes which APM metric data points to fetch.
type APMMetricsQuery struct {
	// Exact service names. Empty means any service.
	Services []string
	// Exact metric names.
	Metrics []string

	Attributes         []APMAttributeFilter
	ResourceAttributes []APMAttributeFilter
	ScopeAttributes    []APMAttributeFilter

	// Maximum number of data points to fetch. The newest points are kept.
	Limit int
}

// apmMetricBaseFields identify a data point and its series.
var apmMetricBaseFields = []string{
	"type", "service_name", "metric_name", "metric_unit", "scope_name",
	"resource_attributes", "attributes", "start_time_unix", "time_unix", "flags",
}

// apmMetricScalarFields is what the plugin needs of Gauge and Sum data points.
var apmMetricScalarFields = append(append([]string{}, apmMetricBaseFields...),
	"value", "aggregation_temporality", "is_monotonic",
)

// apmMetricAllFields adds the histogram fields. Exemplars, descriptions and schema URLs
// are never requested: apmmetric.get returns raw data points and cannot aggregate or
// downsample, so the response has to be kept small.
var apmMetricAllFields = append(append([]string{}, apmMetricScalarFields...),
	"count", "sum", "bucket_counts", "explicit_bounds",
	"scale", "zero_count", "positive_offset", "positive_bucket_counts",
	"negative_offset", "negative_bucket_counts",
)

// apmMetricsPageSize is the number of data points requested per apmmetric.get call.
// The Zabbix frontend builds the whole response in memory, and a single response of
// about 50000 data points exhausts the default PHP memory limit (128M).
var apmMetricsPageSize = 10000

// SeriesKey identifies the series a data point belongs to: metric, type, service,
// scope and both attribute sets.
func (p *APMMetricPoint) SeriesKey() string {
	var sb strings.Builder
	sb.WriteString(p.MetricName)
	sb.WriteByte(0)
	sb.WriteString(strconv.Itoa(p.Type))
	sb.WriteByte(0)
	sb.WriteString(p.ServiceName)
	sb.WriteByte(0)
	sb.WriteString(p.ScopeName)
	for _, attrs := range []APMAttributes{p.ResourceAttributes, p.Attributes} {
		sb.WriteByte(1)
		keys := make([]string, 0, len(attrs))
		for k := range attrs {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			sb.WriteString(k)
			sb.WriteByte(0)
			sb.WriteString(attrs[k])
			sb.WriteByte(0)
		}
	}
	return sb.String()
}

func (p *APMMetricPoint) isHistogram() bool {
	return p.Type == APMMetricTypeHistogram || p.Type == APMMetricTypeExponentialHistogram
}

// GetAPMMetrics fetches APM (OpenTelemetry) metric data points with apmmetric.get
// (Zabbix 8.0+). Points are returned sorted by time, oldest first. When more than
// query.Limit points match, the newest query.Limit points are returned and
// truncated is true.
//
// The points are fetched newest first in pages of apmMetricsPageSize. apmmetric.get
// has no stable order for points with the same timestamp, so instead of an offset
// every page ends where the previous one stopped: it repeats the oldest second of
// the previous page, and the points already seen in that second are dropped.
func (ds *Zabbix) GetAPMMetrics(ctx context.Context, query APMMetricsQuery, timeRange backend.TimeRange) (points []APMMetricPoint, truncated bool, err error) {
	params := ZabbixAPIParams{
		"time_from": timeRange.From.Unix(),
		"sortfield": "time_unix",
		"sortorder": "DESC",
	}

	filter := map[string]interface{}{}
	if len(query.Services) > 0 {
		filter["service_name"] = query.Services
	}
	if len(query.Metrics) > 0 {
		filter["metric_name"] = query.Metrics
	}
	if len(filter) > 0 {
		params["filter"] = filter
	}

	if len(query.Attributes) > 0 {
		params["attributes"] = query.Attributes
	}
	if len(query.ResourceAttributes) > 0 {
		params["resource_attributes"] = query.ResourceAttributes
	}
	if len(query.ScopeAttributes) > 0 {
		params["scope_attributes"] = query.ScopeAttributes
	}

	// One extra point tells whether the result was cut
	wanted := query.Limit + 1
	if query.Limit <= 0 {
		wanted = math.MaxInt
	}

	// time_till is exclusive
	timeTill := timeRange.To.Unix() + 1
	// Points of the oldest second fetched so far: the next page returns them again
	boundarySec := int64(-1)
	boundarySeen := map[string]struct{}{}
	// Histogram fields are requested only when the data holds histograms
	output := apmMetricAllFields
	onlyScalars := true

	for len(points) < wanted {
		pageLimit := apmMetricsPageSize + len(boundarySeen)
		if remaining := wanted - len(points) + len(boundarySeen); remaining < pageLimit {
			pageLimit = remaining
		}

		page, err := ds.getAPMMetricsPage(ctx, params, output, timeTill, pageLimit)
		if err != nil {
			return nil, false, err
		}

		if len(output) < len(apmMetricAllFields) {
			for i := range page {
				if page[i].isHistogram() {
					// The page was fetched without the histogram fields: fetch it again
					output = apmMetricAllFields
					page, err = ds.getAPMMetricsPage(ctx, params, output, timeTill, pageLimit)
					if err != nil {
						return nil, false, err
					}
					break
				}
			}
		}

		added := 0
		for i := range page {
			p := &page[i]
			sec := p.TimeUnix / int64(time.Second)
			key := p.SeriesKey() + "\x00" + strconv.FormatInt(p.TimeUnix, 10)
			if sec == boundarySec {
				if _, seen := boundarySeen[key]; seen {
					continue
				}
			}
			if p.isHistogram() {
				onlyScalars = false
			}
			points = append(points, *p)
			added++
		}

		if len(page) < pageLimit {
			// No more data
			break
		}

		oldestSec := page[len(page)-1].TimeUnix / int64(time.Second)
		if oldestSec != boundarySec {
			boundarySec = oldestSec
			boundarySeen = map[string]struct{}{}
		} else if added == 0 {
			// A full page without a single new point: cannot move past this second
			return nil, false, backend.DownstreamError(errors.New("too many APM data points share one timestamp, narrow the query with attribute filters"))
		}
		for i := len(points) - 1; i >= 0 && points[i].TimeUnix/int64(time.Second) == boundarySec; i-- {
			p := &points[i]
			boundarySeen[p.SeriesKey()+"\x00"+strconv.FormatInt(p.TimeUnix, 10)] = struct{}{}
		}
		timeTill = boundarySec + 1

		if onlyScalars {
			output = apmMetricScalarFields
		}
	}

	if query.Limit > 0 && len(points) > query.Limit {
		points = points[:query.Limit]
		truncated = true
	}

	// Newest first -> oldest first. Pages may interleave points of the boundary second.
	sort.SliceStable(points, func(i, j int) bool {
		return points[i].TimeUnix < points[j].TimeUnix
	})

	return points, truncated, nil
}

func (ds *Zabbix) getAPMMetricsPage(ctx context.Context, baseParams ZabbixAPIParams, output []string, timeTill int64, limit int) ([]APMMetricPoint, error) {
	params := make(ZabbixAPIParams, len(baseParams)+3)
	for k, v := range baseParams {
		params[k] = v
	}
	params["output"] = output
	params["time_till"] = timeTill
	params["limit"] = limit

	result, err := ds.Request(ctx, &ZabbixAPIRequest{Method: "apmmetric.get", Params: params})
	if err != nil {
		return nil, err
	}

	var page []APMMetricPoint
	if err = convertTo(result, &page); err != nil {
		return nil, err
	}
	return page, nil
}

// SplitAPMNames splits a "a|b|c" list, as produced by a multi-value template
// variable, into names. Empty names are dropped.
func SplitAPMNames(value string) []string {
	names := []string{}
	for _, name := range strings.Split(value, "|") {
		name = strings.TrimSpace(name)
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}
