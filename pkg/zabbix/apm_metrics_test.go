package zabbix

import (
	"encoding/json"
	"sort"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAPMAttributesUnmarshal(t *testing.T) {
	var point APMMetricPoint
	// Zabbix serializes an empty attribute set as [] and nanosecond timestamps as numbers
	err := json.Unmarshal([]byte(`{
		"type": 1,
		"resource_attributes": {"service.name": "checkout", "replicas": 3},
		"attributes": [],
		"time_unix": 1794431000865492003,
		"start_time_unix": 1794430999865491878,
		"value": 4,
		"is_monotonic": true
	}`), &point)
	require.NoError(t, err)

	assert.Equal(t, APMAttributes{"service.name": "checkout", "replicas": "3"}, point.ResourceAttributes)
	assert.Empty(t, point.Attributes)
	assert.NotNil(t, point.Attributes)
	assert.Equal(t, int64(1794431000865492003), point.TimeUnix)
	assert.Equal(t, int64(1794431000865492003), point.Time().UnixNano())
	assert.True(t, point.IsMonotonic)
}

func TestGetAPMMetrics(t *testing.T) {
	timeRange := backend.TimeRange{From: time.Unix(1000, 0), To: time.Unix(2000, 0)}

	t.Run("builds the request and returns points oldest first", func(t *testing.T) {
		var params map[string]interface{}
		client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
			if payload.Method == "apiinfo.version" {
				return `{"result":"8.0.0"}`
			}
			require.Equal(t, "apmmetric.get", payload.Method)
			params = payload.Params
			return `{"result":[
				{"metric_name":"m","time_unix":1900000000001,"value":3},
				{"metric_name":"m","time_unix":1800000000001,"value":2},
				{"metric_name":"m","time_unix":1700000000001,"value":1}
			]}`
		})

		points, truncated, err := client.GetAPMMetrics(t.Context(), APMMetricsQuery{
			Services:           []string{"checkout"},
			Metrics:            []string{"m"},
			Attributes:         []APMAttributeFilter{{Key: "http.route", Value: "/pay", Operator: APMOperatorEquals}},
			ResourceAttributes: []APMAttributeFilter{{Key: "host.name", Operator: APMOperatorExists}},
			Limit:              10,
		}, timeRange)
		require.NoError(t, err)

		assert.False(t, truncated)
		require.Len(t, points, 3)
		assert.Equal(t, []float64{1, 2, 3}, []float64{points[0].Value, points[1].Value, points[2].Value})

		assert.EqualValues(t, 1000, params["time_from"])
		// time_till is exclusive
		assert.EqualValues(t, 2001, params["time_till"])
		assert.Equal(t, "time_unix", params["sortfield"])
		assert.Equal(t, "DESC", params["sortorder"])
		assert.EqualValues(t, 11, params["limit"])
		assert.Equal(t, map[string]interface{}{
			"service_name": []interface{}{"checkout"},
			"metric_name":  []interface{}{"m"},
		}, params["filter"])
		assert.Equal(t, []interface{}{
			map[string]interface{}{"key": "http.route", "value": "/pay", "operator": float64(1)},
		}, params["attributes"])
		assert.Contains(t, params, "resource_attributes")
		assert.NotContains(t, params, "scope_attributes")
		assert.NotContains(t, params["output"], "exemplars")
	})

	t.Run("keeps the newest points when the limit is exceeded", func(t *testing.T) {
		client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
			if payload.Method == "apiinfo.version" {
				return `{"result":"8.0.0"}`
			}
			return `{"result":[
				{"metric_name":"m","time_unix":3,"value":3},
				{"metric_name":"m","time_unix":2,"value":2},
				{"metric_name":"m","time_unix":1,"value":1}
			]}`
		})

		points, truncated, err := client.GetAPMMetrics(t.Context(), APMMetricsQuery{Metrics: []string{"m"}, Limit: 2}, timeRange)
		require.NoError(t, err)

		assert.True(t, truncated)
		require.Len(t, points, 2)
		assert.Equal(t, 2.0, points[0].Value)
		assert.Equal(t, 3.0, points[1].Value)
	})
}

// apmFakeServer answers apmmetric.get from an in-memory data set the way Zabbix does:
// newest first, time_till exclusive at second granularity, limit applied last. The order
// of points with the same timestamp flips between calls, as ClickHouse does not define it.
type apmFakeServer struct {
	points []APMMetricPoint
	calls  []map[string]interface{}
}

func (f *apmFakeServer) handle(t *testing.T, payload ApiRequestPayload) string {
	if payload.Method == "apiinfo.version" {
		return `{"result":"8.0.0"}`
	}
	require.Equal(t, "apmmetric.get", payload.Method)
	f.calls = append(f.calls, payload.Params)

	till := int64(payload.Params["time_till"].(float64))
	limit := int(payload.Params["limit"].(float64))
	flip := len(f.calls)%2 == 0

	matched := []APMMetricPoint{}
	for _, p := range f.points {
		if p.TimeUnix/int64(time.Second) < till {
			matched = append(matched, p)
		}
	}
	sort.SliceStable(matched, func(i, j int) bool {
		if matched[i].TimeUnix != matched[j].TimeUnix {
			return matched[i].TimeUnix > matched[j].TimeUnix
		}
		if flip {
			return matched[i].Attributes["series"] > matched[j].Attributes["series"]
		}
		return matched[i].Attributes["series"] < matched[j].Attributes["series"]
	})
	if len(matched) > limit {
		matched = matched[:limit]
	}

	// Only the requested fields are returned
	requested := map[string]bool{}
	for _, field := range payload.Params["output"].([]interface{}) {
		requested[field.(string)] = true
	}
	rows := make([]map[string]interface{}, 0, len(matched))
	for _, p := range matched {
		raw, err := json.Marshal(p)
		require.NoError(t, err)
		row := map[string]interface{}{}
		require.NoError(t, json.Unmarshal(raw, &row))
		for field := range row {
			if !requested[field] {
				delete(row, field)
			}
		}
		rows = append(rows, row)
	}
	body, err := json.Marshal(map[string]interface{}{"result": rows})
	require.NoError(t, err)
	return string(body)
}

func TestGetAPMMetricsPaging(t *testing.T) {
	defer func(size int) { apmMetricsPageSize = size }(apmMetricsPageSize)
	apmMetricsPageSize = 7

	timeRange := backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1000, 0)}
	// 5 series reporting at the same nanosecond every second for 20 seconds: every page
	// border falls inside a group of points with the same timestamp
	build := func(typ int) []APMMetricPoint {
		points := []APMMetricPoint{}
		for sec := int64(1); sec <= 20; sec++ {
			for series := 0; series < 5; series++ {
				points = append(points, APMMetricPoint{
					Type:       typ,
					MetricName: "m",
					Attributes: APMAttributes{"series": string(rune('a' + series))},
					TimeUnix:   sec*int64(time.Second) + 5,
					Value:      float64(sec*10 + int64(series)),
					Count:      7,
				})
			}
		}
		return points
	}
	identity := func(p APMMetricPoint) string {
		return p.Attributes["series"] + "@" + p.Time().String()
	}

	t.Run("returns every point exactly once", func(t *testing.T) {
		server := &apmFakeServer{points: build(APMMetricTypeGauge)}
		client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string { return server.handle(t, payload) })

		points, truncated, err := client.GetAPMMetrics(t.Context(), APMMetricsQuery{Metrics: []string{"m"}, Limit: 1000}, timeRange)
		require.NoError(t, err)
		assert.False(t, truncated)
		require.Len(t, points, 100)

		seen := map[string]bool{}
		for i, p := range points {
			assert.False(t, seen[identity(p)], "duplicate point %s", identity(p))
			seen[identity(p)] = true
			if i > 0 {
				assert.LessOrEqual(t, points[i-1].TimeUnix, p.TimeUnix)
			}
		}
		assert.Greater(t, len(server.calls), 10, "the result is fetched in pages")

		// Gauges need no histogram fields: they are requested for the first page only
		assert.Contains(t, server.calls[0]["output"], "bucket_counts")
		assert.NotContains(t, server.calls[1]["output"], "bucket_counts")
		assert.Contains(t, server.calls[1]["output"], "value")
	})

	t.Run("stops at the limit and keeps the newest points", func(t *testing.T) {
		server := &apmFakeServer{points: build(APMMetricTypeGauge)}
		client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string { return server.handle(t, payload) })

		points, truncated, err := client.GetAPMMetrics(t.Context(), APMMetricsQuery{Metrics: []string{"m"}, Limit: 12}, timeRange)
		require.NoError(t, err)
		assert.True(t, truncated)
		require.Len(t, points, 12)
		// The 10 points of seconds 20 and 19, and 2 of second 18
		assert.Equal(t, int64(18), points[0].TimeUnix/int64(time.Second))
		assert.Equal(t, int64(20), points[11].TimeUnix/int64(time.Second))
		assert.LessOrEqual(t, len(server.calls), 3)
	})

	t.Run("keeps requesting the histogram fields for histograms", func(t *testing.T) {
		server := &apmFakeServer{points: build(APMMetricTypeHistogram)}
		client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string { return server.handle(t, payload) })

		points, _, err := client.GetAPMMetrics(t.Context(), APMMetricsQuery{Metrics: []string{"m"}, Limit: 1000}, timeRange)
		require.NoError(t, err)
		require.Len(t, points, 100)
		for _, call := range server.calls {
			assert.Contains(t, call["output"], "bucket_counts")
		}
		for _, p := range points {
			assert.Equal(t, 7.0, p.Count)
		}
	})

	t.Run("fetches a page again when histograms show up after gauges", func(t *testing.T) {
		mixed := build(APMMetricTypeGauge)
		for i := range mixed {
			// The oldest half of the data are histogram points
			if mixed[i].TimeUnix/int64(time.Second) <= 10 {
				mixed[i].Type = APMMetricTypeHistogram
			}
		}
		server := &apmFakeServer{points: mixed}
		client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string { return server.handle(t, payload) })

		points, _, err := client.GetAPMMetrics(t.Context(), APMMetricsQuery{Metrics: []string{"m"}, Limit: 1000}, timeRange)
		require.NoError(t, err)
		require.Len(t, points, 100)
		for _, p := range points {
			if p.Type == APMMetricTypeHistogram {
				assert.Equal(t, 7.0, p.Count, "histogram point fetched without its fields")
			}
		}
	})
}

func TestSplitAPMNames(t *testing.T) {
	assert.Equal(t, []string{"a", "b"}, SplitAPMNames(" a | b||"))
	assert.Empty(t, SplitAPMNames(""))
}
