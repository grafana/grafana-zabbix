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
	"github.com/stretchr/testify/require"
)

func newTokenTestAPI(t *testing.T, responder func(method string) string) *ZabbixAPI {
	t.Helper()
	client := NewTestClient(func(req *http.Request) *http.Response {
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		var payload struct {
			Method string `json:"method"`
		}
		require.NoError(t, json.Unmarshal(body, &payload))
		return &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(strings.NewReader(responder(payload.Method))),
			Header:     make(http.Header),
		}
	})
	api, err := New(backend.DataSourceInstanceSettings{URL: "http://zabbix.org/zabbix"}, client)
	require.NoError(t, err)
	api.SetAuth("admin")
	return api
}

// First login: no named token exists yet, so the create branch runs.
// Zabbix returns token.create as an object {"tokenids": [...]}.
func TestGenerateUserAPIToken_CreatePath(t *testing.T) {
	api := newTokenTestAPI(t, func(method string) string {
		switch method {
		case "token.get":
			return `{"result":[]}`
		case "token.create":
			return `{"result":{"tokenids":["3"]}}`
		case "token.generate":
			return `{"result":[{"token":"fresh-token"}]}`
		default:
			return `{"result":null}`
		}
	})

	token, err := api.GenerateUserAPIToken(context.Background(), "42", "alice", 64)
	require.NoError(t, err)
	assert.Equal(t, "fresh-token", token)
}

// Subsequent login: the named token already exists, so the get branch is used.
func TestGenerateUserAPIToken_ExistingTokenPath(t *testing.T) {
	api := newTokenTestAPI(t, func(method string) string {
		switch method {
		case "token.get":
			return `{"result":[{"tokenid":"100"}]}`
		case "token.create":
			t.Errorf("token.create must not be called when a token already exists")
			return `{"result":null}`
		case "token.generate":
			return `{"result":[{"token":"regenerated-token"}]}`
		default:
			return `{"result":null}`
		}
	})

	token, err := api.GenerateUserAPIToken(context.Background(), "42", "alice", 64)
	require.NoError(t, err)
	assert.Equal(t, "regenerated-token", token)
}
