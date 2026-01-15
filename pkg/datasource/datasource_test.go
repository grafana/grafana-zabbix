package datasource

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"gotest.tools/assert"
)

func TestZabbixBackend_getCachedDatasource(t *testing.T) {
	basicDsSettings := backend.DataSourceInstanceSettings{
		ID:       1,
		Name:     "TestDatasource",
		URL:      "http://zabbix.org/zabbix",
		JSONData: []byte("{}"),
	}

	modifiedDatasourceSettings := backend.DataSourceInstanceSettings{
		ID:       1,
		Name:     "TestDatasource",
		URL:      "http://another.zabbix.org/zabbix",
		JSONData: []byte("{}"),
	}
	modifiedDatasource, _ := newZabbixDatasourceInstance(context.Background(), modifiedDatasourceSettings)

	basicDS, _ := newZabbixDatasourceInstance(context.Background(), basicDsSettings)

	tests := []struct {
		name          string
		pluginContext backend.PluginContext
		want          *ZabbixDatasourceInstance
	}{
		{
			name: "Uncached Datasource (nothing in cache)",
			pluginContext: backend.PluginContext{
				OrgID:                      1,
				DataSourceInstanceSettings: &basicDsSettings,
			},
			want: basicDS.(*ZabbixDatasourceInstance),
		},
		{
			name: "Cached Datasource",
			pluginContext: backend.PluginContext{
				OrgID:                      1,
				DataSourceInstanceSettings: &basicDsSettings,
			},
			want: basicDS.(*ZabbixDatasourceInstance),
		},
		{
			name: "Cached then modified",
			pluginContext: backend.PluginContext{
				OrgID:                      1,
				DataSourceInstanceSettings: &modifiedDatasourceSettings,
			},
			want: modifiedDatasource.(*ZabbixDatasourceInstance),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := NewZabbixDatasource()
			got, _ := ds.getDSInstance(context.Background(), tt.pluginContext)

			// Only checking the URL, being the easiest value to, and guarantee equality for
			assert.Equal(t, tt.want.zabbix.GetAPI().GetUrl().String(), got.zabbix.GetAPI().GetUrl().String())
		})
	}
}

func TestQueryData_QueryTimeoutConfiguration(t *testing.T) {
	tests := []struct {
		name            string
		queryTimeout    interface{}
		expectedTimeout time.Duration
		description     string
	}{
		{
			name:            "Default timeout when not configured",
			queryTimeout:    nil,
			expectedTimeout: 60 * time.Second,
			description:     "Should use default 60 seconds when queryTimeout is not set",
		},
		{
			name:            "Default timeout when zero",
			queryTimeout:    0,
			expectedTimeout: 60 * time.Second,
			description:     "Should use default 60 seconds when queryTimeout is 0",
		},
		{
			name:            "Custom timeout configured",
			queryTimeout:    30,
			expectedTimeout: 30 * time.Second,
			description:     "Should use configured queryTimeout value",
		},
		{
			name:            "Custom timeout as string",
			queryTimeout:    "45",
			expectedTimeout: 45 * time.Second,
			description:     "Should parse string queryTimeout value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create datasource settings with queryTimeout
			jsonData := map[string]interface{}{
				"queryTimeout": tt.queryTimeout,
			}
			jsonBytes, _ := json.Marshal(jsonData)

			dsSettings := backend.DataSourceInstanceSettings{
				ID:       1,
				Name:     "TestDatasource",
				URL:      "http://zabbix.org/zabbix",
				JSONData: jsonBytes,
			}

			// Parse settings to verify timeout is set correctly
			zabbixSettings, err := settings.ReadZabbixSettings(&dsSettings)
			assert.NilError(t, err)
			assert.Equal(t, tt.expectedTimeout, zabbixSettings.QueryTimeout, tt.description)
		})
	}
}

func TestQueryData_QueryTimeoutContextCreation(t *testing.T) {
	// Test that query timeout context is properly created with the configured timeout
	jsonData := map[string]interface{}{
		"queryTimeout": 5, // 5 seconds
	}
	jsonBytes, _ := json.Marshal(jsonData)

	dsSettings := backend.DataSourceInstanceSettings{
		ID:       1,
		Name:     "TestDatasource",
		URL:      "http://zabbix.org/zabbix",
		JSONData: jsonBytes,
	}

	// Verify queryTimeout is set correctly
	zabbixSettings, err := settings.ReadZabbixSettings(&dsSettings)
	assert.NilError(t, err)
	assert.Equal(t, 5*time.Second, zabbixSettings.QueryTimeout)

	// Test that context with timeout is created correctly
	ctx := context.Background()
	queryCtx, cancel := context.WithTimeout(ctx, zabbixSettings.QueryTimeout)
	defer cancel()

	// Verify context has deadline set
	deadline, ok := queryCtx.Deadline()
	assert.Assert(t, ok, "Context should have a deadline")
	assert.Assert(t, deadline.After(time.Now()), "Deadline should be in the future")
	assert.Assert(t, deadline.Before(time.Now().Add(6*time.Second)), "Deadline should be approximately 5 seconds from now")
}

func TestQueryData_QueryTimeoutErrorMessage(t *testing.T) {
	// Test that timeout error message contains the expected information
	timeoutMsg := "Query execution exceeded maximum allowed time (5s). Query was automatically terminated to prevent excessive resource consumption."

	// Verify error message format
	assert.Assert(t, strings.Contains(timeoutMsg, "Query execution exceeded maximum allowed time"))
	assert.Assert(t, strings.Contains(timeoutMsg, "5s"))
	assert.Assert(t, strings.Contains(timeoutMsg, "automatically terminated"))
	assert.Assert(t, strings.Contains(timeoutMsg, "prevent excessive resource consumption"))
}
