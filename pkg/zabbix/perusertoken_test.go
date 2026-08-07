package zabbix

import (
	"context"
	"testing"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// When a request carries a per-user token and Zabbix rejects it as unauthorized,
// the client must NOT silently re-login with the shared/stored credentials
// (which would run the query as the stored user — a privilege escalation).
func TestRequest_PerUserTokenNotAuthorized_DoesNotReloginAsStoredUser(t *testing.T) {
	var loginAttempted bool
	client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
		switch payload.Method {
		case "user.login":
			loginAttempted = true
			return `{"result":"stored-admin-session"}`
		case "host.get":
			return `{"error":{"code":-32602,"message":"Not authorised.","data":""}}`
		default:
			return `{"result":null}`
		}
	})

	ctx := zabbixapi.WithPerUserToken(context.Background(), "alice-token")
	_, err := client.request(ctx, "host.get", ZabbixAPIParams{})

	require.Error(t, err, "an unauthorized per-user token should surface the error")
	assert.Contains(t, err.Error(), "Not authorised.")
	assert.False(t, loginAttempted, "must not re-login with stored credentials for a per-user request")
}
