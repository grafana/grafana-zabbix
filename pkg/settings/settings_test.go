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
