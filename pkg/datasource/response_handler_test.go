package datasource

import (
	"testing"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSanitizeTagName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{name: "simple name", input: "service", expected: "service"},
		{name: "spaces", input: "App Name", expected: "App_Name"},
		{name: "dots and dashes", input: "App.Name-test", expected: "App_Name_test"},
		{name: "all special characters", input: "!!!", expected: "___"},
		{name: "empty string", input: "", expected: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, sanitizeTagName(tt.input))
		})
	}
}

func TestAddItemTagScopedVars(t *testing.T) {
	scopedVars := map[string]ScopedVar{}

	addItemTagScopedVars(scopedVars, []zabbix.Tag{
		{Tag: "service", Value: "payment"},
		{Tag: "App Name", Value: "api"},
		{Tag: "service", Value: "checkout"},
		{Tag: "monitoring"},
	})

	assert.Equal(t, ScopedVar{Value: "checkout, payment"}, scopedVars["__zbx_item_tag_service"])
	assert.Equal(t, ScopedVar{Value: "api"}, scopedVars["__zbx_item_tag_App_Name"])
	assert.Equal(t, ScopedVar{Value: ""}, scopedVars["__zbx_item_tag_monitoring"])
}

func TestSeriesToDataFrameItemTagScopedVars(t *testing.T) {
	series := &timeseries.TimeSeriesData{
		Meta: timeseries.TimeSeriesMeta{
			Name: "CPU load",
			Item: &zabbix.Item{
				Name:  "CPU load",
				Key:   "system.cpu.load",
				Delay: "1m",
				Tags: []zabbix.Tag{
					{Tag: "service", Value: "checkout"},
					{Tag: "Env", Value: "prod"},
				},
			},
		},
	}

	frame := seriesToDataFrame(series, nil)
	require.NotNil(t, frame)

	valueField, fieldIndex := frame.FieldByName(data.TimeSeriesValueFieldName)
	require.NotEqual(t, -1, fieldIndex)
	require.NotNil(t, valueField)

	scopedVars := valueField.Config.Custom["scopedVars"].(map[string]ScopedVar)

	assert.Equal(t, ScopedVar{Value: "checkout"}, scopedVars["__zbx_item_tag_service"])
	assert.Equal(t, ScopedVar{Value: "prod"}, scopedVars["__zbx_item_tag_Env"])
}
