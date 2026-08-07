package datasource

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
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

// authTestHarness is a goroutine-safe mock Zabbix backend. It reports Zabbix
// v7.4 so auth travels as an Authorization Bearer header, letting tests
// distinguish which token a request was made with.
type authTestHarness struct {
	mu            sync.Mutex
	generateCalls int
	// rejectTokens holds per-user tokens the mock rejects with "Not authorised."
	rejectTokens map[string]bool
	// nextToken is what token.generate returns
	nextToken string
}

func (h *authTestHarness) respond(method string, authHeader string) string {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Bootstrap calls (user lookup and token management) must always be
	// authenticated with the stored credentials — never with a (possibly
	// rejected) per-user token.
	storedOnly := func(response string) string {
		if authHeader != "Bearer "+testStoredAuth {
			return `{"error":{"code":-32602,"message":"Invalid params.","data":"bootstrap call made without stored credentials (auth: ` + authHeader + `)"}}`
		}
		return response
	}

	switch method {
	case "apiinfo.version":
		return `{"result":"7.4.0"}`
	case "user.get":
		return storedOnly(`{"result":[{"userid":"42","username":"alice"}]}`)
	case "token.get":
		return storedOnly(`{"result":[{"tokenid":"100"}]}`)
	case "token.generate":
		if resp := storedOnly(""); resp != "" {
			return resp
		}
		h.generateCalls++
		return `{"result":[{"token":"` + h.nextToken + `"}]}`
	default:
		// Data queries: reject configured tokens, succeed otherwise.
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if h.rejectTokens[token] {
			return `{"error":{"code":-32602,"message":"Invalid params.","data":"Not authorised."}}`
		}
		return `{"result":[{"eventid":"1"}]}`
	}
}

func (h *authTestHarness) generateCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.generateCalls
}

func buildRecoveryTestInstance(t *testing.T, harness *authTestHarness) (*ZabbixDatasource, *ZabbixDatasourceInstance) {
	t.Helper()

	httpClient := zabbixapi.NewTestClient(func(req *http.Request) *http.Response {
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		var payload struct {
			Method string `json:"method"`
		}
		require.NoError(t, json.Unmarshal(body, &payload))

		respBody := harness.respond(payload.Method, req.Header.Get("Authorization"))
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

	zabbixSettings := &settings.ZabbixDatasourceSettings{
		Timeout:          10 * time.Second,
		CacheTTL:         time.Minute,
		PerUserAuth:      true,
		PerUserAuthField: "username",
	}
	zc, err := zabbix.New(&dsInfo, zabbixSettings, api)
	require.NoError(t, err)

	inst := &ZabbixDatasourceInstance{
		dsInfo:   &dsInfo,
		zabbix:   zc,
		Settings: zabbixSettings,
		logger:   log.New(),
	}
	ds := &ZabbixDatasource{
		logger:     log.New(),
		tokenCache: cache.NewTokenCache(),
	}
	return ds, inst
}

// A rejected cached token must be evicted and regenerated once, and the
// request retried with the fresh token — without falling back to admin.
func TestPerUserAuth_RejectedCachedTokenIsRefreshedAndRetried(t *testing.T) {
	harness := &authTestHarness{
		rejectTokens: map[string]bool{"stale-token": true},
		nextToken:    "fresh-token",
	}
	ds, inst := buildRecoveryTestInstance(t, harness)
	ds.tokenCache.Set("ds-uid", "alice", "42", "stale-token", time.Hour)

	ctx := backend.WithUser(context.Background(), &backend.User{Login: "alice"})
	ctx, err := ds.applyPerUserAuth(ctx, inst, "ds-uid")
	require.NoError(t, err)
	assert.Equal(t, "stale-token", zabbixapi.PerUserTokenFromContext(ctx), "cached (stale) token is used first")

	resp, err := inst.zabbix.Request(ctx, &zabbix.ZabbixAPIRequest{Method: "problem.get"})
	require.NoError(t, err, "request should succeed after automatic token refresh")
	require.NotNil(t, resp)

	assert.Equal(t, 1, harness.generateCount(), "exactly one token regeneration")
	cached, ok := ds.tokenCache.Get("ds-uid", "alice")
	require.True(t, ok, "fresh token should be cached")
	assert.Equal(t, "fresh-token", cached.Token)
}

// If the regenerated token is also rejected, the request must fail — exactly
// one refresh attempt, no loop, no admin fallback.
func TestPerUserAuth_RefreshDoesNotLoop(t *testing.T) {
	harness := &authTestHarness{
		rejectTokens: map[string]bool{"stale-token": true, "also-bad": true},
		nextToken:    "also-bad",
	}
	ds, inst := buildRecoveryTestInstance(t, harness)
	ds.tokenCache.Set("ds-uid", "alice", "42", "stale-token", time.Hour)

	ctx := backend.WithUser(context.Background(), &backend.User{Login: "alice"})
	ctx, err := ds.applyPerUserAuth(ctx, inst, "ds-uid")
	require.NoError(t, err)

	_, err = inst.zabbix.Request(ctx, &zabbix.ZabbixAPIRequest{Method: "problem.get"})
	require.Error(t, err, "second rejection must surface the error")
	assert.Contains(t, err.Error(), "Not authorised.")
	assert.Equal(t, 1, harness.generateCount(), "exactly one refresh attempt, no loop")
}

// Concurrent cold-cache requests for the same user must generate exactly one
// token: token.generate invalidates previous values of the same named token,
// so a stampede would leave most requests holding dead tokens.
func TestPerUserAuth_ConcurrentColdCacheGeneratesOnce(t *testing.T) {
	harness := &authTestHarness{
		rejectTokens: map[string]bool{},
		nextToken:    "the-one-token",
	}
	ds, inst := buildRecoveryTestInstance(t, harness)

	const workers = 20
	tokens := make([]string, workers)
	errs := make([]error, workers)

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			ctx := backend.WithUser(context.Background(), &backend.User{Login: "alice"})
			gotCtx, err := ds.applyPerUserAuth(ctx, inst, "ds-uid")
			errs[i] = err
			tokens[i] = zabbixapi.PerUserTokenFromContext(gotCtx)
		}(i)
	}
	wg.Wait()

	for i := 0; i < workers; i++ {
		require.NoError(t, errs[i], "request %d should succeed", i)
		assert.Equal(t, "the-one-token", tokens[i], "request %d should hold the shared token", i)
	}
	assert.Equal(t, 1, harness.generateCount(), "token.generate must be called exactly once")
}
