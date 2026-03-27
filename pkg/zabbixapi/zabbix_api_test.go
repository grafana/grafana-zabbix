package zabbixapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

var version = 65

func TestZabbixAPIUnauthenticatedQuery(t *testing.T) {
	zabbixApi, _ := MockZabbixAPI(`{"result":"sampleResult"}`, 200)
	resp, err := zabbixApi.RequestUnauthenticated(context.Background(), "test.get", map[string]interface{}{}, version)

	assert.Equal(t, "sampleResult", resp.MustString())
	assert.Nil(t, err)
}

func TestLogin(t *testing.T) {
	zabbixApi, _ := MockZabbixAPI(`{"result":"secretauth"}`, 200)
	err := zabbixApi.Authenticate(context.Background(), "user", "password", version)

	assert.Nil(t, err)
	assert.Equal(t, "secretauth", zabbixApi.auth)
}

func TestZabbixAPI(t *testing.T) {
	tests := []struct {
		name                string
		auth                string
		mockApiResponse     string
		mockApiResponseCode int
		expectedResult      string
		expectedError       error
		version             int
	}{
		{
			name:                "Simple request",
			auth:                "secretauth",
			mockApiResponse:     `{"result":"sampleResult"}`,
			mockApiResponseCode: 200,
			expectedResult:      "sampleResult",
			expectedError:       nil,
		},
		{
			name:                "Request should return error if API not authenticated",
			auth:                "",
			mockApiResponse:     `{"result":"sampleResult"}`,
			mockApiResponseCode: 200,
			expectedResult:      "",
			expectedError:       backend.DownstreamError(ErrNotAuthenticated),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			zabbixApi, _ := MockZabbixAPI(tt.mockApiResponse, tt.mockApiResponseCode)
			zabbixApi.auth = tt.auth
			resp, err := zabbixApi.Request(context.Background(), "test.get", map[string]interface{}{}, version)

			if tt.expectedError != nil {
				assert.Equal(t, err, tt.expectedError)
			} else {
				assert.NotNil(t, resp)
				// assert.Equal(t, tt.expectedResult, resp.MustString())
				assert.Nil(t, err)
			}
		})
	}
}

func TestHandleAPIResult(t *testing.T) {
	tests := []struct {
		name          string
		response      string
		expectedData  interface{}
		expectedError string
		isDownstream  bool
	}{
		{
			name:         "Valid JSON with result",
			response:     `{"result": {"data": "test"}}`,
			expectedData: map[string]interface{}{"data": "test"},
		},
		{
			name:          "Invalid JSON",
			response:      `{"result": invalid}`,
			expectedError: "invalid character 'i' looking for beginning of value",
			isDownstream:  true,
		},
		{
			name:          "API error response",
			response:      `{"error": {"message": "Authentication failed", "data": "Session terminated"}}`,
			expectedError: "Authentication failed Session terminated",
			isDownstream:  true,
		},
		{
			name:         "Empty result",
			response:     `{"result": []}`,
			expectedData: []interface{}{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := handleAPIResult([]byte(tt.response))

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError, err.Error())
				if tt.isDownstream {
					assert.True(t, backend.IsDownstreamError(err), "error should be a downstream error")
				}
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.expectedData, result.Interface())
		})
	}
}

func TestRequestAuthMechanismByVersion(t *testing.T) {
	tests := []struct {
		name              string
		version           int
		basicAuthEnabled  bool
		expectBodyAuth    bool
		expectBearer      bool
		expectErrorSubstr string
	}{
		{
			name:             "v6.0 uses auth in body",
			version:          60,
			expectBodyAuth:   true,
			expectBearer:     false,
			basicAuthEnabled: false,
		},
		{
			name:             "v7.0 without basic auth uses bearer header",
			version:          70,
			expectBodyAuth:   false,
			expectBearer:     true,
			basicAuthEnabled: false,
		},
		{
			name:             "v7.0 with basic auth keeps auth in body",
			version:          70,
			expectBodyAuth:   true,
			expectBearer:     false,
			basicAuthEnabled: true,
		},
		{
			name:              "v7.2 with basic auth is not supported",
			version:           72,
			basicAuthEnabled:  true,
			expectErrorSubstr: "basic auth is not supported for Zabbix v7.2 and later",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var requestBody map[string]interface{}
			var authHeader string

			testClient := NewTestClient(func(req *http.Request) *http.Response {
				body, err := io.ReadAll(req.Body)
				assert.NoError(t, err)

				err = json.Unmarshal(body, &requestBody)
				assert.NoError(t, err)

				authHeader = req.Header.Get("Authorization")
				return &http.Response{
					StatusCode: 200,
					Body:       io.NopCloser(strings.NewReader(`{"result":"ok"}`)),
					Header:     make(http.Header),
				}
			})

			dsSettings := backend.DataSourceInstanceSettings{
				URL:              "http://localhost/api_jsonrpc.php",
				BasicAuthEnabled: tt.basicAuthEnabled,
			}

			api, err := New(dsSettings, testClient)
			assert.NoError(t, err)
			api.SetAuth("session-token")

			_, err = api.Request(context.Background(), "hostgroup.get", map[string]interface{}{}, tt.version)
			if tt.expectErrorSubstr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectErrorSubstr)
				return
			}

			assert.NoError(t, err)
			_, hasAuth := requestBody["auth"]
			assert.Equal(t, tt.expectBodyAuth, hasAuth)
			if tt.expectBodyAuth {
				assert.Equal(t, "session-token", requestBody["auth"])
			}

			if tt.expectBearer {
				assert.Equal(t, "Bearer session-token", authHeader)
			} else {
				assert.Empty(t, authHeader)
			}
		})
	}
}
