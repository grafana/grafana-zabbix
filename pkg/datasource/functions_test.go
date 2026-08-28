package datasource

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyFunctionsFunction(t *testing.T) {
	f := new(float64)
	*f = 1.0
	series := []*timeseries.TimeSeriesData{
		{
			TS: timeseries.TimeSeries{
				{Time: time.Time{}, Value: f},
				{Time: time.Time{}, Value: f},
			},
		},
	}

	tests := []struct {
		name      string
		functions []QueryFunction
		wantErr   bool
	}{
		{
			name: "unsupported function",
			functions: []QueryFunction{
				{
					Def: QueryFunctionDef{
						Name: "unsupportedFunction",
					},
					Params: []interface{}{},
				},
			},
			wantErr: true,
		},
		{
			name: "data processing function with params error",
			functions: []QueryFunction{
				{
					Def: QueryFunctionDef{
						Name: "groupBy",
					},
					Params: []interface {
					}{1},
				},
			},
			wantErr: true,
		},
		{
			name: "aggregate function with params error",
			functions: []QueryFunction{
				{
					Def: QueryFunctionDef{
						Name: "aggregateBy",
					},
					Params: []interface {
					}{1},
				},
			},
			wantErr: true,
		},
		{
			name: "filter function with params error",
			functions: []QueryFunction{
				{
					Def: QueryFunctionDef{
						Name: "top",
					},
					Params: []interface {
					}{"string"},
				},
			},
			wantErr: true,
		},
		{
			name: "skipped function should return no error",
			functions: []QueryFunction{
				{
					Def: QueryFunctionDef{
						Name: "setAlias",
					},
					Params: []interface {
					}{},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := applyFunctions(series, tt.functions)
			if tt.wantErr {
				assert.Error(t, err, "expected error for function")
				// Check if the error is a downstream error
				assert.Truef(t, backend.IsDownstreamError(err), "error is not a downstream error")
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
func TestIsRangeSeriesVariable(t *testing.T) {
	tests := []struct {
		interval string
		want     bool
	}{
		{RANGE_VARIABLE_VALUE, true},
		{"$__range_series", true},
		{"${__range_series}", true},
		{" $__range_series ", true},
		{"1h", false},
		{"$__range", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.interval, func(t *testing.T) {
			assert.Equal(t, tt.want, isRangeSeriesVariable(tt.interval))
		})
	}
}

// TestApplyFunctionsRangeSeriesMacro verifies functions accept the whole-range
// interval both as the expanded sentinel and as the unexpanded macro (the latter
// is what the backend receives from alerting queries)
func TestApplyFunctionsRangeSeriesMacro(t *testing.T) {
	makeSeries := func(values ...float64) *timeseries.TimeSeriesData {
		ts := make(timeseries.TimeSeries, 0, len(values))
		for i := range values {
			ts = append(ts, timeseries.TimePoint{
				Time:  time.Unix(int64(i*60), 0),
				Value: &values[i],
			})
		}
		return &timeseries.TimeSeriesData{TS: ts}
	}

	for _, interval := range []string{RANGE_VARIABLE_VALUE, "$__range_series"} {
		t.Run(interval, func(t *testing.T) {
			functions := []QueryFunction{
				{
					Def:    QueryFunctionDef{Name: "groupBy"},
					Params: []interface{}{interval, "avg"},
				},
				{
					Def:    QueryFunctionDef{Name: "percentile"},
					Params: []interface{}{interval, 95.0},
				},
				{
					Def:    QueryFunctionDef{Name: "percentileAgg"},
					Params: []interface{}{interval, 95.0},
				},
			}

			series := []*timeseries.TimeSeriesData{makeSeries(1, 2, 3), makeSeries(4, 5, 6)}
			result, err := applyFunctions(series, functions)
			assert.NoError(t, err)
			assert.NotEmpty(t, result)
		})
	}
}

// TestApplyFunctionsPreFunction tests the applyFunctionsPre function for error handling
func TestApplyFunctionsPreFunction(t *testing.T) {
	query := QueryModel{
		Functions: []QueryFunction{
			{
				Def: QueryFunctionDef{
					Name: "timeShift",
				},
				Params: []interface{}{1},
			},
		}}

	items := []*zabbix.Item{}
	err := applyFunctionsPre(&query, items)

	assert.Error(t, err, "expected error for function")
	// Check if the error is a downstream error
	assert.Truef(t, backend.IsDownstreamError(err), "error is not a downstream error")

}

// TestApplyScale verifies scale() accepts both param encodings the frontend
// produces: a freshly added function serializes its default factor as a JSON
// number (defaultParams: [100]), while a value typed in the editor is stored
// as a string.
func TestApplyScale(t *testing.T) {
	newSeries := func() timeseries.TimeSeries {
		v1, v2 := 1.0, 2.0
		return timeseries.TimeSeries{
			{Time: time.Time{}, Value: &v1},
			{Time: time.Time{}, Value: &v2},
		}
	}

	tests := []struct {
		name    string
		param   interface{}
		want    []float64
		wantErr bool
	}{
		{name: "numeric param (function added with default)", param: float64(100), want: []float64{100, 200}},
		{name: "string param (value typed in editor)", param: "100", want: []float64{100, 200}},
		{name: "invalid param", param: "not-a-number", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := applyScale(newSeries(), tt.param)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			for i, want := range tt.want {
				assert.Equal(t, want, *result[i].Value)
			}
		})
	}
}

// newTestSeriesData returns fresh series suitable for any processing function:
// two series with monotonic timestamps, so grouping and filter functions work.
func newTestSeriesData() []*timeseries.TimeSeriesData {
	newTS := func(name string, values ...float64) *timeseries.TimeSeriesData {
		start := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		s := &timeseries.TimeSeriesData{}
		s.Meta.Name = name
		for i, v := range values {
			value := v
			s.TS = append(s.TS, timeseries.TimePoint{Time: start.Add(time.Duration(i) * time.Minute), Value: &value})
		}
		return s
	}
	return []*timeseries.TimeSeriesData{
		newTS("series A", 1, 2, 3),
		newTS("series B", 4, 5, 6),
	}
}

// TestApplyFunctionsScale runs scale() through applyFunctions — the same
// dispatch path the query handler uses — with both param encodings.
func TestApplyFunctionsScale(t *testing.T) {
	tests := []struct {
		name  string
		param interface{}
	}{
		{name: "numeric param (function added with default)", param: float64(100)},
		{name: "string param (value typed in editor)", param: "100"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			functions := []QueryFunction{
				{
					Def:    QueryFunctionDef{Name: "scale"},
					Params: []interface{}{tt.param},
				},
			}

			result, err := applyFunctions(newTestSeriesData(), functions)
			assert.NoError(t, err)
			require.Len(t, result, 2)
			assert.Equal(t, []float64{100, 200, 300}, seriesValues(t, result[0].TS))
			assert.Equal(t, []float64{400, 500, 600}, seriesValues(t, result[1].TS))
		})
	}
}

func seriesValues(t *testing.T, ts timeseries.TimeSeries) []float64 {
	t.Helper()
	values := make([]float64, 0, len(ts))
	for _, p := range ts {
		require.NotNil(t, p.Value)
		values = append(values, *p.Value)
	}
	return values
}

// TestQueryModelFunctionsRoundTrip unmarshals a query JSON payload shaped
// exactly as the frontend sends it (numeric default param in functions) into
// QueryModel via ReadQuery and runs function application on it.
func TestQueryModelFunctionsRoundTrip(t *testing.T) {
	tests := []struct {
		name      string
		paramJSON string
	}{
		{name: "numeric param as saved by a fresh scale() with defaults", paramJSON: `[100]`},
		{name: "string param as saved after typing in the editor", paramJSON: `["100"]`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			queryJSON := `{
				"queryType": "0",
				"group": {"filter": "/.*/"},
				"host": {"filter": "backend01"},
				"application": {"filter": ""},
				"itemTag": {"filter": ""},
				"item": {"filter": "CPU utilization"},
				"functions": [
					{
						"def": {
							"name": "scale",
							"category": "Transform",
							"params": [{"name": "factor", "type": "float", "options": [100, 0.01, 10, -1]}],
							"defaultParams": [100]
						},
						"params": ` + tt.paramJSON + `,
						"text": "scale(100)"
					}
				],
				"options": {"showDisabledItems": false, "disableDataAlignment": false, "useZabbixValueMapping": false, "useTrends": "default"}
			}`

			query, err := ReadQuery(backend.DataQuery{
				RefID:     "A",
				QueryType: "0",
				JSON:      []byte(queryJSON),
			})
			require.NoError(t, err)
			require.Len(t, query.Functions, 1)

			result, err := applyFunctions(newTestSeriesData(), query.Functions)
			assert.NoError(t, err)
			require.Len(t, result, 2)
			assert.Equal(t, []float64{100, 200, 300}, seriesValues(t, result[0].TS))
		})
	}
}

// frontendFuncDef is a function definition parsed from the frontend source
// (src/datasource/metricFunctions.ts): its name and its defaultParams with
// the types json.Unmarshal would produce (float64 for numbers, string for
// quoted values) — i.e. exactly what the backend receives for a function
// freshly added in the query editor.
type frontendFuncDef struct {
	name          string
	defaultParams []interface{}
}

// parseFrontendFuncDefs extracts every addFuncDef({...}) block from
// metricFunctions.ts. Parsing the real frontend source keeps this contract
// test from silently drifting: a new frontend function or a changed default
// automatically flows into TestBackendAcceptsFrontendDefaultParams.
func parseFrontendFuncDefs(t *testing.T) []frontendFuncDef {
	t.Helper()

	source, err := os.ReadFile(filepath.Join("..", "..", "src", "datasource", "metricFunctions.ts"))
	require.NoError(t, err, "cannot read frontend function definitions")

	blockRe := regexp.MustCompile(`(?s)addFuncDef\(\{(.*?)\}\);`)
	nameRe := regexp.MustCompile(`name:\s*'([^']*)'`)
	defaultParamsRe := regexp.MustCompile(`defaultParams:\s*\[([^\]]*)\]`)

	var defs []frontendFuncDef
	for _, block := range blockRe.FindAllStringSubmatch(string(source), -1) {
		nameMatch := nameRe.FindStringSubmatch(block[1])
		require.NotNilf(t, nameMatch, "addFuncDef block without a name: %s", block[1])

		def := frontendFuncDef{name: nameMatch[1]}
		paramsMatch := defaultParamsRe.FindStringSubmatch(block[1])
		require.NotNilf(t, paramsMatch, "function %s: no defaultParams found", def.name)

		for _, rawParam := range strings.Split(paramsMatch[1], ",") {
			rawParam = strings.TrimSpace(rawParam)
			if rawParam == "" {
				continue
			}
			if strings.HasPrefix(rawParam, "'") && strings.HasSuffix(rawParam, "'") {
				def.defaultParams = append(def.defaultParams, strings.Trim(rawParam, "'"))
				continue
			}
			value, err := strconv.ParseFloat(rawParam, 64)
			require.NoErrorf(t, err, "function %s: cannot parse default param %q", def.name, rawParam)
			def.defaultParams = append(def.defaultParams, value)
		}
		defs = append(defs, def)
	}

	// Guard against the parser silently matching nothing after a frontend refactor.
	require.GreaterOrEqual(t, len(defs), 15, "suspiciously few functions parsed from metricFunctions.ts — parser out of sync with the file format?")
	names := make(map[string]bool, len(defs))
	for _, def := range defs {
		names[def.name] = true
	}
	for _, expected := range []string{"scale", "offset", "groupBy", "top", "percentile"} {
		require.Truef(t, names[expected], "function %s not parsed from metricFunctions.ts", expected)
	}

	return defs
}

// TestBackendAcceptsFrontendDefaultParams is a cross-cutting contract test:
// for every function the frontend offers, the backend must accept its
// defaultParams in both encodings the frontend produces — as JSON numbers
// (function freshly added in the editor, or a dashboard saved that way) and
// as strings (value retyped in the editor). scale() used to fail the first
// encoding; this catches the whole class of such drift.
func TestBackendAcceptsFrontendDefaultParams(t *testing.T) {
	encodings := []struct {
		name   string
		encode func(param interface{}) interface{}
	}{
		{
			name:   "defaults as JSON numbers (freshly added function)",
			encode: func(param interface{}) interface{} { return param },
		},
		{
			name: "defaults as strings (values typed in the editor)",
			encode: func(param interface{}) interface{} {
				if f, ok := param.(float64); ok {
					return strconv.FormatFloat(f, 'f', -1, 64)
				}
				return param
			},
		},
	}

	for _, def := range parseFrontendFuncDefs(t) {
		for _, encoding := range encodings {
			t.Run(def.name+" / "+encoding.name, func(t *testing.T) {
				params := make([]interface{}, 0, len(def.defaultParams))
				for _, param := range def.defaultParams {
					params = append(params, encoding.encode(param))
				}

				functions := []QueryFunction{
					{
						Def:    QueryFunctionDef{Name: def.name},
						Params: params,
					},
				}

				_, err := applyFunctions(newTestSeriesData(), functions)
				assert.NoErrorf(t, err, "backend rejects %s with frontend default params %v", def.name, params)
			})
		}
	}
}
