package datasource

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/cache"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testStoredAuth = "stored-admin-session"

// buildTestInstance wires up a ZabbixDatasource + instance backed by a mock HTTP
// client. responses maps a Zabbix API method to the raw JSON body to return.
// Every call to the mock appends its method to *calls, so tests can assert which
// API methods were (or were not) invoked. Params are intentionally not parsed so
// that array-param methods like token.generate work.
func buildTestInstance(t *testing.T, s *settings.ZabbixDatasourceSettings, responses map[string]string, calls *[]string) (*ZabbixDatasource, *ZabbixDatasourceInstance) {
	t.Helper()

	httpClient := zabbixapi.NewTestClient(func(req *http.Request) *http.Response {
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)

		var payload struct {
			Method string `json:"method"`
		}
		require.NoError(t, json.Unmarshal(body, &payload))
		if calls != nil {
			*calls = append(*calls, payload.Method)
		}

		respBody, ok := responses[payload.Method]
		if !ok {
			respBody = `{"result":null}`
		}
		return &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(strings.NewReader(respBody)),
			Header:     make(http.Header),
		}
	})

	dsInfo := backend.DataSourceInstanceSettings{URL: "http://zabbix.org/zabbix"}
	api, err := zabbixapi.New(dsInfo, httpClient)
	require.NoError(t, err)
	api.SetAuth(testStoredAuth)

	internalSettings := &settings.ZabbixDatasourceSettings{Timeout: 10 * time.Second, CacheTTL: time.Minute}
	zc, err := zabbix.New(&dsInfo, internalSettings, api)
	require.NoError(t, err)

	inst := &ZabbixDatasourceInstance{
		dsInfo:   &dsInfo,
		zabbix:   zc,
		Settings: s,
		logger:   log.New(),
	}
	ds := &ZabbixDatasource{
		logger:     log.New(),
		tokenCache: cache.NewTokenCache(),
	}
	return ds, inst
}

func happyPathResponses() map[string]string {
	return map[string]string{
		"apiinfo.version": `{"result":"6.4.0"}`,
		"user.get":        `{"result":[{"userid":"42","username":"alice"}]}`,
		"token.get":       `{"result":[{"tokenid":"100"}]}`,
		"token.generate":  `{"result":[{"token":"generated-token-xyz"}]}`,
	}
}

func TestApplyPerUserAuth_DisabledIsNoOp(t *testing.T) {
	var calls []string
	ds, inst := buildTestInstance(t, &settings.ZabbixDatasourceSettings{PerUserAuth: false}, nil, &calls)

	ctx := backend.WithUser(context.Background(), &backend.User{Login: "alice"})
	gotCtx, err := ds.applyPerUserAuth(ctx, inst, "ds-uid")

	require.NoError(t, err)
	assert.Empty(t, zabbixapi.PerUserTokenFromContext(gotCtx), "no per-user token when disabled")
	assert.Equal(t, testStoredAuth, inst.zabbix.GetAPI().GetAuth(), "shared auth must be untouched when disabled")
	assert.Empty(t, calls, "no API calls expected when per-user auth disabled")
}

func TestApplyPerUserAuth_NoUserInContext(t *testing.T) {
	ds, inst := buildTestInstance(t, &settings.ZabbixDatasourceSettings{PerUserAuth: true, PerUserAuthField: "username"}, nil, nil)

	gotCtx, err := ds.applyPerUserAuth(context.Background(), inst, "ds-uid")

	require.Error(t, err, "anonymous/guest access should be rejected when per-user auth is on")
	assert.Empty(t, zabbixapi.PerUserTokenFromContext(gotCtx))
	assert.Equal(t, testStoredAuth, inst.zabbix.GetAPI().GetAuth())
}

func TestApplyPerUserAuth_ExcludedUserUsesStoredCreds(t *testing.T) {
	var calls []string
	s := &settings.ZabbixDatasourceSettings{
		PerUserAuth:             true,
		PerUserAuthField:        "username",
		PerUserAuthExcludeUsers: []string{"alice"},
	}
	ds, inst := buildTestInstance(t, s, happyPathResponses(), &calls)

	ctx := backend.WithUser(context.Background(), &backend.User{Login: "alice"})
	gotCtx, err := ds.applyPerUserAuth(ctx, inst, "ds-uid")

	require.NoError(t, err)
	assert.Empty(t, zabbixapi.PerUserTokenFromContext(gotCtx), "excluded user must not carry a per-user token (falls back to stored creds)")
	assert.Equal(t, testStoredAuth, inst.zabbix.GetAPI().GetAuth(), "excluded user must keep stored credentials")
	assert.Empty(t, calls, "excluded user should not trigger any Zabbix API calls")
	_, ok := ds.tokenCache.Get("ds-uid", "alice", "alice")
	assert.False(t, ok, "excluded user must not be cached")
}

func TestApplyPerUserAuth_ExclusionIsCaseInsensitive(t *testing.T) {
	s := &settings.ZabbixDatasourceSettings{
		PerUserAuth:             true,
		PerUserAuthField:        "username",
		PerUserAuthExcludeUsers: []string{"Admin"},
	}
	ds, inst := buildTestInstance(t, s, happyPathResponses(), nil)

	ctx := backend.WithUser(context.Background(), &backend.User{Login: "admin"})
	gotCtx, err := ds.applyPerUserAuth(ctx, inst, "ds-uid")

	require.NoError(t, err)
	assert.Empty(t, zabbixapi.PerUserTokenFromContext(gotCtx))
	assert.Equal(t, testStoredAuth, inst.zabbix.GetAPI().GetAuth())
}

func TestApplyPerUserAuth_HappyPathScopesAndCachesToken(t *testing.T) {
	s := &settings.ZabbixDatasourceSettings{PerUserAuth: true, PerUserAuthField: "username"}
	ds, inst := buildTestInstance(t, s, happyPathResponses(), nil)

	ctx := backend.WithUser(context.Background(), &backend.User{Login: "alice"})
	gotCtx, err := ds.applyPerUserAuth(ctx, inst, "ds-uid")

	require.NoError(t, err)
	// Token is scoped to the returned context, NOT written to the shared instance.
	assert.Equal(t, "generated-token-xyz", zabbixapi.PerUserTokenFromContext(gotCtx), "returned context should carry the user's token")
	assert.Equal(t, testStoredAuth, inst.zabbix.GetAPI().GetAuth(), "shared instance auth must NOT be mutated (concurrency safety)")

	cached, ok := ds.tokenCache.Get("ds-uid", "alice", "alice")
	require.True(t, ok, "token should be cached after generation")
	assert.Equal(t, "generated-token-xyz", cached.Token)
}

func TestApplyPerUserAuth_UsesCachedTokenWithoutAPICalls(t *testing.T) {
	var calls []string
	s := &settings.ZabbixDatasourceSettings{PerUserAuth: true, PerUserAuthField: "username"}
	ds, inst := buildTestInstance(t, s, happyPathResponses(), &calls)
	ds.tokenCache.Set("ds-uid", "alice", "alice", "cached-token", time.Hour)

	ctx := backend.WithUser(context.Background(), &backend.User{Login: "alice"})
	gotCtx, err := ds.applyPerUserAuth(ctx, inst, "ds-uid")

	require.NoError(t, err)
	assert.Equal(t, "cached-token", zabbixapi.PerUserTokenFromContext(gotCtx))
	assert.Equal(t, testStoredAuth, inst.zabbix.GetAPI().GetAuth(), "shared instance auth must NOT be mutated")
	assert.Empty(t, calls, "a cache hit must not issue any Zabbix API calls")
}

func TestApplyPerUserAuth_EmailFieldSelectsEmailIdentity(t *testing.T) {
	s := &settings.ZabbixDatasourceSettings{PerUserAuth: true, PerUserAuthField: "email"}
	ds, inst := buildTestInstance(t, s, happyPathResponses(), nil)

	ctx := backend.WithUser(context.Background(), &backend.User{Login: "alice", Email: "alice@example.com"})
	_, err := ds.applyPerUserAuth(ctx, inst, "ds-uid")

	require.NoError(t, err)
	_, ok := ds.tokenCache.Get("ds-uid", "alice@example.com", "alice@example.com")
	assert.True(t, ok, "cache key should use the email identity when field is email")
}

func TestApplyPerUserAuth_UserNotFoundInZabbix(t *testing.T) {
	responses := happyPathResponses()
	responses["user.get"] = `{"result":[]}`
	s := &settings.ZabbixDatasourceSettings{PerUserAuth: true, PerUserAuthField: "username"}
	ds, inst := buildTestInstance(t, s, responses, nil)

	ctx := backend.WithUser(context.Background(), &backend.User{Login: "ghost"})
	_, err := ds.applyPerUserAuth(ctx, inst, "ds-uid")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found in Zabbix")

}
