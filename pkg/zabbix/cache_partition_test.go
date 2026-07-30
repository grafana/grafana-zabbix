package zabbix

import (
	"context"
	"testing"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The response cache must be partitioned per user token: a response fetched
// under one user's Zabbix permissions must never be served from cache to a
// request authenticated as another user (or as the shared stored user).
func TestRequest_ResponseCacheIsPartitionedPerUserToken(t *testing.T) {
	backendCalls := 0
	client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
		switch payload.Method {
		case "apiinfo.version":
			return `{"result":"6.4.0"}`
		case "hostgroup.get":
			backendCalls++
			return `{"result":[{"groupid":"1"}]}`
		default:
			return `{"result":null}`
		}
	})

	apiReq := &ZabbixAPIRequest{Method: "hostgroup.get", Params: ZabbixAPIParams{"output": "extend"}}

	ctxUserA := zabbixapi.WithPerUserToken(context.Background(), "token-user-a")
	ctxUserB := zabbixapi.WithPerUserToken(context.Background(), "token-user-b")
	ctxShared := context.Background()

	// User A: miss then hit.
	_, err := client.Request(ctxUserA, apiReq)
	require.NoError(t, err)
	assert.Equal(t, 1, backendCalls, "user A first request hits the backend")

	_, err = client.Request(ctxUserA, apiReq)
	require.NoError(t, err)
	assert.Equal(t, 1, backendCalls, "user A repeat request is served from cache")

	// User B: same request must NOT reuse user A's cached response.
	_, err = client.Request(ctxUserB, apiReq)
	require.NoError(t, err)
	assert.Equal(t, 2, backendCalls, "user B must not be served user A's cached response")

	// Shared credentials: separate partition as well.
	_, err = client.Request(ctxShared, apiReq)
	require.NoError(t, err)
	assert.Equal(t, 3, backendCalls, "shared-credential request must not reuse per-user responses")

	_, err = client.Request(ctxShared, apiReq)
	require.NoError(t, err)
	assert.Equal(t, 3, backendCalls, "shared-credential repeat request is served from cache")
}
