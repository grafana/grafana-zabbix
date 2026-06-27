package settings

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadZabbixSettings_PerUserAuthExcludeUsers(t *testing.T) {
	dsInstance := &backend.DataSourceInstanceSettings{
		JSONData: []byte(`{
			"perUserAuth": true,
			"perUserAuthField": "email",
			"perUserAuthExcludeUsers": ["admin", "service-account"]
		}`),
	}

	s, err := ReadZabbixSettings(dsInstance)
	require.NoError(t, err)

	assert.True(t, s.PerUserAuth)
	assert.Equal(t, "email", s.PerUserAuthField)
	// Regression guard: the exclude list must survive parsing and not be dropped.
	assert.Equal(t, []string{"admin", "service-account"}, s.PerUserAuthExcludeUsers)
}

func TestReadZabbixSettings_PerUserAuthFieldDefaultsToUsername(t *testing.T) {
	dsInstance := &backend.DataSourceInstanceSettings{
		JSONData: []byte(`{"perUserAuth": true}`),
	}

	s, err := ReadZabbixSettings(dsInstance)
	require.NoError(t, err)

	assert.True(t, s.PerUserAuth)
	assert.Equal(t, "username", s.PerUserAuthField, "field should default to username when per-user auth is on")
}

func TestReadZabbixSettings_PerUserAuthDisabledByDefault(t *testing.T) {
	dsInstance := &backend.DataSourceInstanceSettings{
		JSONData: []byte(`{"username": "admin"}`),
	}

	s, err := ReadZabbixSettings(dsInstance)
	require.NoError(t, err)

	assert.False(t, s.PerUserAuth)
	assert.Empty(t, s.PerUserAuthField)
	assert.Nil(t, s.PerUserAuthExcludeUsers)
	assert.Equal(t, AuthTypeUserLogin, s.AuthType, "auth type should default to userLogin")
}

func TestParseTimeoutValue(t *testing.T) {
	tests := []struct {
		name         string
		value        interface{}
		defaultValue int64
		fieldName    string
		want         int64
		wantErr      bool
	}{
		{
			name:         "valid string",
			value:        "45",
			defaultValue: 30,
			fieldName:    "timeout",
			want:         45,
			wantErr:      false,
		},
		{
			name:         "empty string returns default",
			value:        "",
			defaultValue: 30,
			fieldName:    "timeout",
			want:         30,
			wantErr:      false,
		},
		{
			name:         "invalid string returns error",
			value:        "not-a-number",
			defaultValue: 30,
			fieldName:    "timeout",
			want:         0,
			wantErr:      true,
		},
		{
			name:         "float64 value",
			value:        float64(60),
			defaultValue: 30,
			fieldName:    "timeout",
			want:         60,
			wantErr:      false,
		},
		{
			name:         "int64 value",
			value:        int64(90),
			defaultValue: 30,
			fieldName:    "timeout",
			want:         90,
			wantErr:      false,
		},
		{
			name:         "int value",
			value:        int(120),
			defaultValue: 30,
			fieldName:    "timeout",
			want:         120,
			wantErr:      false,
		},
		{
			name:         "nil returns default",
			value:        nil,
			defaultValue: 30,
			fieldName:    "timeout",
			want:         30,
			wantErr:      false,
		},
		{
			name:         "unknown type returns default",
			value:        []string{"invalid"},
			defaultValue: 60,
			fieldName:    "queryTimeout",
			want:         60,
			wantErr:      false,
		},
		{
			name:         "zero string value",
			value:        "0",
			defaultValue: 30,
			fieldName:    "timeout",
			want:         0,
			wantErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseTimeoutValue(tt.value, tt.defaultValue, tt.fieldName)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.fieldName)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}
