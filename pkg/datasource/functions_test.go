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
