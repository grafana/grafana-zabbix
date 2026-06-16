package zabbix

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

var BasicDatasourceInfo = &backend.DataSourceInstanceSettings{
	ID:       1,
	Name:     "TestDatasource",
	URL:      "http://zabbix.org/zabbix",
	JSONData: []byte(`{"username":"username", "password":"password", "cacheTTL":"10m"}`),
}

type ApiRequestPayload struct {
	Method string                 `json:"method"`
	Params map[string]interface{} `json:"params"`
}

func MockZabbixClient(dsInfo *backend.DataSourceInstanceSettings, body string, statusCode int) (*Zabbix, error) {
	zabbixAPI, err := zabbixapi.MockZabbixAPI(body, statusCode)
	if err != nil {
		return nil, err
	}
	zabbixSettings := &settings.ZabbixDatasourceSettings{
		Timeout: 10 * time.Second,
	}

	client, err := New(dsInfo, zabbixSettings, zabbixAPI)
	if err != nil {
		return nil, err
	}

	return client, nil
}

func MockZabbixClientResponse(client *Zabbix, body string, statusCode int) (*Zabbix, error) {
	zabbixAPI, err := zabbixapi.MockZabbixAPI(body, statusCode)
	if err != nil {
		return nil, err
	}

	client.api = zabbixAPI

	return client, nil
}

func NewZabbixClientWithHandler(t *testing.T, handler func(ApiRequestPayload) string) *Zabbix {
	t.Helper()

	httpClient := zabbixapi.NewTestClient(func(req *http.Request) *http.Response {
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)

		var payload ApiRequestPayload
		require.NoError(t, json.Unmarshal(body, &payload))

		responseBody := handler(payload)
		if responseBody == "" {
			responseBody = `{"result":null}`
		}

		return &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(strings.NewReader(responseBody)),
			Header:     make(http.Header),
		}
	})

	dsSettings := *BasicDatasourceInfo
	zabbixAPI, err := zabbixapi.New(dsSettings, httpClient)
	require.NoError(t, err)

	zabbixSettings := &settings.ZabbixDatasourceSettings{
		Timeout: 10 * time.Second,
	}
	client, err := New(BasicDatasourceInfo, zabbixSettings, zabbixAPI)
	require.NoError(t, err)

	client.api.SetAuth("test")
	client.version = 60

	return client
}

func NewZabbixClientWithResponses(t *testing.T, responses map[string]string) *Zabbix {
	return NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
		if resp, ok := responses[payload.Method]; ok {
			return resp
		}
		return `{"result":null}`
	})
}
