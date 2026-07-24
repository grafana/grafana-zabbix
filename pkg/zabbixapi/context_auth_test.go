package zabbixapi

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// For Zabbix v7.2+ the auth token is sent as an "Authorization: Bearer" header,
// which lets us assert exactly which token a request was made with.
func newAuthCapturingAPI(t *testing.T, captured *string) *ZabbixAPI {
	t.Helper()
	client := NewTestClient(func(req *http.Request) *http.Response {
		*captured = req.Header.Get("Authorization")
		return &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(strings.NewReader(`{"result":[]}`)),
			Header:     make(http.Header),
		}
	})
	api, err := New(backend.DataSourceInstanceSettings{URL: "http://zabbix.org/zabbix"}, client)
	require.NoError(t, err)
	return api
}

func TestRequest_PerUserTokenFromContextOverridesStoredAuth(t *testing.T) {
	var authHeader string
	api := newAuthCapturingAPI(t, &authHeader)
	api.SetAuth("stored-admin-token")

	ctx := WithPerUserToken(context.Background(), "alice-token")
	_, err := api.Request(ctx, "host.get", map[string]interface{}{}, 72)
	require.NoError(t, err)

	assert.Equal(t, "Bearer alice-token", authHeader, "request must use the per-user token from context")
	assert.Equal(t, "stored-admin-token", api.GetAuth(), "stored auth must remain unchanged (shared state untouched)")
}

func TestRequest_FallsBackToStoredAuthWithoutContextToken(t *testing.T) {
	var authHeader string
	api := newAuthCapturingAPI(t, &authHeader)
	api.SetAuth("stored-admin-token")

	_, err := api.Request(context.Background(), "host.get", map[string]interface{}{}, 72)
	require.NoError(t, err)

	assert.Equal(t, "Bearer stored-admin-token", authHeader, "without a context token, the stored auth is used")
}

func TestRequest_NotAuthenticatedWhenNeitherTokenPresent(t *testing.T) {
	var authHeader string
	api := newAuthCapturingAPI(t, &authHeader)
	// No SetAuth and no context token.

	_, err := api.Request(context.Background(), "host.get", map[string]interface{}{}, 72)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrNotAuthenticated)
}
