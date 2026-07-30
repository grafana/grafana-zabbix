package datasource

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// zabbixServerMock emulates the Zabbix JSON-RPC endpoint behind a real
// httptest.Server, so handler tests exercise the full stack: HTTP handler →
// per-user auth → instance manager → real HTTP client → "Zabbix".
type zabbixServerMock struct {
	mu sync.Mutex
	// authByMethod records the Authorization header of the last call per method.
	authByMethod map[string]string
	callCount    map[string]int
	// userGetResult lets tests control whether the target user exists.
	userGetResult string
}

func (m *zabbixServerMock) handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var payload struct {
			Method string `json:"method"`
		}
		_ = json.Unmarshal(body, &payload)

		m.mu.Lock()
		m.authByMethod[payload.Method] = r.Header.Get("Authorization")
		m.callCount[payload.Method]++
		userGet := m.userGetResult
		m.mu.Unlock()

		var resp string
		switch payload.Method {
		case "apiinfo.version":
			resp = `{"jsonrpc":"2.0","result":"7.4.0","id":2}`
		case "user.login":
			resp = `{"jsonrpc":"2.0","result":"stored-session","id":2}`
		case "user.get":
			resp = `{"jsonrpc":"2.0","result":` + userGet + `,"id":2}`
		case "token.get":
			resp = `{"jsonrpc":"2.0","result":[{"tokenid":"100"}],"id":2}`
		case "token.generate":
			resp = `{"jsonrpc":"2.0","result":[{"token":"user-token-abc"}],"id":2}`
		case "hostgroup.get":
			resp = `{"jsonrpc":"2.0","result":[{"groupid":"1","name":"Test group"}],"id":2}`
		default:
			resp = `{"jsonrpc":"2.0","result":null,"id":2}`
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(resp))
	}
}

func (m *zabbixServerMock) auth(method string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.authByMethod[method]
}

func (m *zabbixServerMock) calls(method string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.callCount[method]
}

func newHandlerTestRequest(t *testing.T, serverURL string, user *backend.User) *http.Request {
	t.Helper()
	dsSettings := backend.DataSourceInstanceSettings{
		ID:   1,
		UID:  "smoke-uid",
		URL:  serverURL,
		Name: "SmokeTestDatasource",
		JSONData: []byte(`{
			"username": "stored-admin",
			"perUserAuth": true,
			"perUserAuthField": "username",
			"perUserAuthExcludeUsers": []
		}`),
		DecryptedSecureJSONData: map[string]string{"password": "stored-pass"},
	}
	pluginCtx := backend.PluginContext{OrgID: 1, DataSourceInstanceSettings: &dsSettings}

	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	if user != nil {
		ctx = backend.WithUser(ctx, user)
	}

	body := `{"method":"hostgroup.get","params":{"output":"extend"}}`
	return httptest.NewRequest(http.MethodPost, "/zabbix-api", strings.NewReader(body)).WithContext(ctx)
}

// Smoke test for the whole per-user auth flow through the real resource
// handler: stored-credential bootstrap (cold start), user lookup, token
// generation, and — critically — the data query being issued with the
// per-user token. Guards against regressions where the handler drops the
// auth-carrying context (e.g. by passing req.Context() to the query).
func TestZabbixAPIHandler_PerUserAuthSmoke(t *testing.T) {
	mock := &zabbixServerMock{
		authByMethod:  map[string]string{},
		callCount:     map[string]int{},
		userGetResult: `[{"userid":"42","username":"alice"}]`,
	}
	server := httptest.NewServer(mock.handler())
	defer server.Close()

	ds := NewZabbixDatasource()
	defer ds.Close()

	rw := httptest.NewRecorder()
	ds.ZabbixAPIHandler(rw, newHandlerTestRequest(t, server.URL, &backend.User{Login: "alice"}))

	require.Equal(t, http.StatusOK, rw.Code, "handler should succeed, body: %s", rw.Body.String())
	assert.Contains(t, rw.Body.String(), "Test group")

	// Cold start: the shared client had no session, so it must have logged in
	// with the stored credentials before looking up the user.
	assert.Equal(t, 1, mock.calls("user.login"), "stored-credential login expected exactly once")

	// Bootstrap calls run with the stored session, never a user token.
	assert.Equal(t, "Bearer stored-session", mock.auth("user.get"))
	assert.Equal(t, "Bearer stored-session", mock.auth("token.get"))
	assert.Equal(t, "Bearer stored-session", mock.auth("token.generate"))
	assert.Equal(t, 1, mock.calls("token.generate"), "token generated exactly once")

	// The data query must carry the per-user token — not the stored session.
	assert.Equal(t, "Bearer user-token-abc", mock.auth("hostgroup.get"),
		"data query must be issued with the per-user token (auth context dropped by the handler?)")
}

// When the Grafana user has no matching Zabbix user, the handler must reject
// the request with 403 and never fall back to the stored credentials.
func TestZabbixAPIHandler_PerUserAuthUserNotFoundReturns403(t *testing.T) {
	mock := &zabbixServerMock{
		authByMethod:  map[string]string{},
		callCount:     map[string]int{},
		userGetResult: `[]`,
	}
	server := httptest.NewServer(mock.handler())
	defer server.Close()

	ds := NewZabbixDatasource()
	defer ds.Close()

	rw := httptest.NewRecorder()
	ds.ZabbixAPIHandler(rw, newHandlerTestRequest(t, server.URL, &backend.User{Login: "ghost"}))

	assert.Equal(t, http.StatusForbidden, rw.Code, "missing Zabbix user must yield 403, body: %s", rw.Body.String())
	assert.Equal(t, 0, mock.calls("hostgroup.get"), "data query must never run with stored credentials")
}
