package datasource

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Regression tests for VUL-2026-0236: with shared stored credentials (the
// default, perUserAuth off) the resource handler must not forward mutating
// Zabbix methods for a caller whose Grafana role is too low.

func newAuthzTestRequest(t *testing.T, serverURL string, role string, disableReadOnlyAck bool, body string) *http.Request {
	t.Helper()
	jsonData := `{"username":"stored-admin","disableReadOnlyUsersAck":false}`
	if disableReadOnlyAck {
		jsonData = `{"username":"stored-admin","disableReadOnlyUsersAck":true}`
	}
	dsSettings := backend.DataSourceInstanceSettings{
		ID:                      1,
		UID:                     "authz-uid",
		URL:                     serverURL,
		Name:                    "AuthzTestDatasource",
		JSONData:                []byte(jsonData),
		DecryptedSecureJSONData: map[string]string{"password": "stored-pass"},
	}
	pluginCtx := backend.PluginContext{OrgID: 1, DataSourceInstanceSettings: &dsSettings}

	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	ctx = backend.WithUser(ctx, &backend.User{Login: "caller", Role: role})

	return httptest.NewRequest(http.MethodPost, "/zabbix-api", strings.NewReader(body)).WithContext(ctx)
}

func TestZabbixAPIHandler_RoleGate(t *testing.T) {
	const (
		scriptExecute = `{"method":"script.execute","params":{"scriptid":"1","hostid":"10084"}}`
		eventAck      = `{"method":"event.acknowledge","params":{"eventids":["1"],"action":4,"message":"hi"}}`
		userGet       = `{"method":"user.get","params":{"output":["userid","username"]}}`
	)
	tests := []struct {
		name               string
		role               string
		disableReadOnlyAck bool
		body               string
		method             string
		wantForbidden      bool
	}{
		{name: "viewer script.execute", role: "Viewer", body: scriptExecute, method: "script.execute", wantForbidden: true},
		{name: "editor script.execute", role: "Editor", body: scriptExecute, method: "script.execute", wantForbidden: true},
		{name: "no role script.execute", role: "", body: scriptExecute, method: "script.execute", wantForbidden: true},
		{name: "admin script.execute", role: "Admin", body: scriptExecute, method: "script.execute"},
		{name: "viewer event.acknowledge, setting off", role: "Viewer", body: eventAck, method: "event.acknowledge"},
		{name: "viewer event.acknowledge, setting on", role: "Viewer", disableReadOnlyAck: true, body: eventAck, method: "event.acknowledge", wantForbidden: true},
		{name: "editor event.acknowledge, setting on", role: "Editor", disableReadOnlyAck: true, body: eventAck, method: "event.acknowledge"},
		{name: "viewer user.get", role: "Viewer", disableReadOnlyAck: true, body: userGet, method: "user.get"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
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
			ds.ZabbixAPIHandler(rw, newAuthzTestRequest(t, server.URL, tt.role, tt.disableReadOnlyAck, tt.body))

			if tt.wantForbidden {
				assert.Equal(t, http.StatusForbidden, rw.Code, "body: %s", rw.Body.String())
				assert.Contains(t, rw.Body.String(), ErrInsufficientRole.Error())
				assert.Equal(t, 0, mock.calls(tt.method), "%s must never reach Zabbix", tt.method)
				assert.Equal(t, 0, mock.calls("user.login"), "stored credentials must not be used")
				return
			}
			require.Equal(t, http.StatusOK, rw.Code, "body: %s", rw.Body.String())
			assert.Equal(t, 1, mock.calls(tt.method), "%s should reach Zabbix", tt.method)
			assert.Equal(t, "Bearer stored-session", mock.auth(tt.method))
		})
	}
}
