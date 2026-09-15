package datasource

import (
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
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
