package zabbixapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests require a running Zabbix server and proper environment variables
// ZABBIX_URL - URL of the Zabbix server (e.g., http://localhost/zabbix/api_jsonrpc.php)
// ZABBIX_USER - Username for authentication
// ZABBIX_PASSWORD - Password for authentication
// To run locally, start devenv/zabbix74 and run INTEGRATION_TEST74=true ZABBIX_URL="http://localhost:8188/api_jsonrpc.php" ZABBIX_USER="Admin" ZABBIX_PASSWORD="zabbix" go test -v ./pkg/zabbixapi/...

func TestIntegrationZabbixAPI74(t *testing.T) {
	// Skip if not running integration tests
	if os.Getenv("INTEGRATION_TEST74") != "true" {
		t.Skip("Skipping integration test")
	}

	// Get test configuration from environment
	zabbixURL := os.Getenv("ZABBIX_URL")
	zabbixUser := os.Getenv("ZABBIX_USER")
	zabbixPassword := os.Getenv("ZABBIX_PASSWORD")
	targetUsername := os.Getenv("ZABBIX_TARGET_USER")
	zabbixVersion := 74

	// Validate required environment variables
	require.NotEmpty(t, zabbixURL, "ZABBIX_URL environment variable is required")
	require.NotEmpty(t, zabbixUser, "ZABBIX_USER environment variable is required")
	require.NotEmpty(t, zabbixPassword, "ZABBIX_PASSWORD environment variable is required")
	require.NotEmpty(t, targetUsername, "ZABBIX_TARGET_USER environment variable is required")

	// Create new Zabbix API instance
	dsSettings := backend.DataSourceInstanceSettings{
		URL: zabbixURL,
	}
	api, err := New(dsSettings, nil)
	require.NoError(t, err)
	require.NotNil(t, api)

	// Test authentication
	t.Run("Authentication", func(t *testing.T) {
		err := api.Authenticate(context.Background(), zabbixUser, zabbixPassword, zabbixVersion)
		require.NoError(t, err)
		assert.NotEmpty(t, api.GetAuth(), "Authentication token should not be empty")
	})

	// Test API version check
	t.Run("API Version Check", func(t *testing.T) {
		// Try to get API version
		resp, err := api.RequestUnauthenticated(context.Background(), "apiinfo.version", map[string]interface{}{}, zabbixVersion)
		require.NoError(t, err)
		require.NotNil(t, resp)

		version := resp.MustString()
		assert.NotEmpty(t, version, "API version should not be empty")
	})

	// Test host group retrieval
	t.Run("Get Host Groups", func(t *testing.T) {
		// First authenticate
		err := api.Authenticate(context.Background(), zabbixUser, zabbixPassword, zabbixVersion)
		require.NoError(t, err)

		// Get host groups
		params := map[string]interface{}{
			"output": "extend",
		}
		resp, err := api.Request(context.Background(), "hostgroup.get", params, zabbixVersion)
		require.NoError(t, err)
		require.NotNil(t, resp)

		// Verify response is an array
		groups, err := resp.Array()
		require.NoError(t, err)
		assert.NotNil(t, groups, "Host groups should not be nil")
	})

	// Test error handling
	t.Run("Error Handling", func(t *testing.T) {
		// Try to make a request without authentication
		api.SetAuth("")
		_, err := api.Request(context.Background(), "hostgroup.get", map[string]interface{}{}, zabbixVersion)
		assert.Error(t, err)
		assert.True(t, backend.IsDownstreamError(err))
	})

	// Test auth parameter is not in request body for v7.2+
	t.Run("Auth Parameter Not In Request Body", func(t *testing.T) {
		// First authenticate
		err := api.Authenticate(context.Background(), zabbixUser, zabbixPassword, zabbixVersion)
		require.NoError(t, err)

		// Create a test client that captures the request body
		var requestBody map[string]interface{}
		testClient := NewTestClient(func(req *http.Request) *http.Response {
			// Read and parse the request body
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			err = json.Unmarshal(body, &requestBody)
			require.NoError(t, err)

			// Verify auth header is present
			assert.Equal(t, "Bearer "+api.GetAuth(), req.Header.Get("Authorization"), "Authorization header should be present with Bearer token")

			// Return a mock response
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBufferString(`{"result": "test"}`)),
			}
		})

		// Create a new API instance with the test client
		apiWithTestClient, err := New(dsSettings, testClient)
		require.NoError(t, err)
		apiWithTestClient.SetAuth(api.GetAuth())

		// Make a request
		_, err = apiWithTestClient.Request(context.Background(), "test.get", map[string]interface{}{}, zabbixVersion)
		require.NoError(t, err)

		// Verify auth parameter is not in the request body
		_, hasAuth := requestBody["auth"]
		assert.False(t, hasAuth, "Auth parameter should not be present in request body for v7.2+")
	})

	// Test basic auth is not supported in v7.2+
	t.Run("Basic Auth Not Supported", func(t *testing.T) {
		// Create settings with basic auth enabled
		dsSettingsWithBasicAuth := backend.DataSourceInstanceSettings{
			URL:              zabbixURL,
			BasicAuthEnabled: true,
			BasicAuthUser:    zabbixUser,
		}

		// Create a new API instance with basic auth enabled
		apiWithBasicAuth, err := New(dsSettingsWithBasicAuth, nil)
		require.NoError(t, err)
		require.NotNil(t, apiWithBasicAuth)

		// Get host groups
		params := map[string]interface{}{
			"output": "extend",
		}

		apiWithBasicAuth.SetAuth("something")

		// Try to authenticate
		_, err = apiWithBasicAuth.Request(context.Background(), "hostgroup.get", params, zabbixVersion)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Basic Auth is not supported for Zabbix v7.2 and later")
		assert.True(t, backend.IsDownstreamError(err))
	})

	// Test per-user authentication
	t.Run("Per-User Authentication", func(t *testing.T) {
		// First authenticate
		err := api.Authenticate(context.Background(), zabbixUser, zabbixPassword, zabbixVersion)
		require.NoError(t, err)

		// Query Zabbix for the target user
		zabbixUserResp, err := api.GetUserByIdentity(context.Background(), "username", targetUsername, zabbixVersion)
		require.NoError(t, err)
		require.NotNil(t, zabbixUserResp)

		if len(zabbixUserResp.MustArray()) == 0 {
			t.Skipf("User %s not found in Zabbix. Skipping per-user auth test.", targetUsername)
		}

		userId := zabbixUserResp.GetIndex(0).Get("userid").MustString()

		// Generate or retrieve Zabbix API token for the user
		token, err := api.GenerateUserAPIToken(context.Background(), userId, zabbixVersion)
		require.NoError(t, err)
		assert.NotEmpty(t, token, "Generated token should not be empty")

		api.SetAuth(token)

		// Optionally, perform a simple API call as the user
		resp, err := api.Request(context.Background(), "hostgroup.get", map[string]interface{}{"output": "extend"}, zabbixVersion)
		require.NoError(t, err)
		require.NotNil(t, resp)

		t.Logf("Per-user authentication successful for identity %s (userId %s)", targetUsername, userId)
	})
}
