package zabbix

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStringInt_UnmarshalJSON_Valid(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected int
		str      string
	}{
		{"numeric string", `"1"`, 1, "1"},
		{"numeric string zero", `"0"`, 0, "0"},
		{"integer", `2`, 2, "2"},
		{"integer zero", `0`, 0, "0"},
		{"whole float", `2.0`, 2, "2"},
		{"whole float zero", `0.0`, 0, "0"},
		{"empty string", `""`, 0, ""},
		{"null", `null`, 0, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var si StringInt
			err := json.Unmarshal([]byte(tt.json), &si)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, si.Int())
			assert.Equal(t, tt.str, si.String())
		})
	}
}

func TestStringInt_UnmarshalJSON_Invalid(t *testing.T) {
	tests := []struct {
		name string
		json string
	}{
		{"non-numeric string", `"contains"`},
		{"alphanumeric string", `"1a"`},
		{"fractional float", `1.5`},
		{"boolean true", `true`},
		{"boolean false", `false`},
		{"array", `[1]`},
		{"object", `{"op": 1}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var si StringInt
			err := json.Unmarshal([]byte(tt.json), &si)
			assert.Error(t, err)
		})
	}
}

func TestHostTagFilter_UnmarshalJSON(t *testing.T) {
	validJSON := `{"tag":"env","value":"prod","operator":"1"}`
	var filter HostTagFilter
	err := json.Unmarshal([]byte(validJSON), &filter)
	require.NoError(t, err)
	assert.Equal(t, "env", filter.Tag)
	assert.Equal(t, "prod", filter.Value)
	assert.Equal(t, 1, filter.Operator.Int())

	invalidJSON := `{"tag":"env","value":"prod","operator":"invalid"}`
	var badFilter HostTagFilter
	err = json.Unmarshal([]byte(invalidJSON), &badFilter)
	assert.Error(t, err)
}
