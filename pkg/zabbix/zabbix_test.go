package zabbix

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var basicDatasourceInfo = &backend.DataSourceInstanceSettings{
	ID:       1,
	Name:     "TestDatasource",
	URL:      "http://zabbix.org/zabbix",
	JSONData: []byte(`{"username":"username", "password":"password", "cacheTTL":"10m"}`),
}

var emptyParams = map[string]interface{}{}

func TestLogin(t *testing.T) {
	zabbixClient, _ := MockZabbixClient(basicDatasourceInfo, `{"result":"secretauth"}`, 200)
	err := zabbixClient.Authenticate(context.Background())

	assert.NoError(t, err)
	assert.Equal(t, "secretauth", zabbixClient.api.GetAuth())
}

func TestLoginError(t *testing.T) {
	zabbixClient, _ := MockZabbixClient(basicDatasourceInfo, `{"result":""}`, 500)
	err := zabbixClient.Authenticate(context.Background())

	assert.Error(t, err)
	assert.Equal(t, "", zabbixClient.api.GetAuth())
}

func TestZabbixAPIQuery(t *testing.T) {
	zabbixClient, _ := MockZabbixClient(basicDatasourceInfo, `{"result":"test"}`, 200)
	resp, err := zabbixClient.Request(context.Background(), &ZabbixAPIRequest{Method: "test.get", Params: emptyParams})

	assert.NoError(t, err)

	result, err := resp.String()
	assert.NoError(t, err)
	assert.Equal(t, "test", result)
}

func TestCachedQuery(t *testing.T) {
	// Using methods with caching enabled
	query := &ZabbixAPIRequest{Method: "host.get", Params: emptyParams}
	zabbixClient, _ := MockZabbixClient(basicDatasourceInfo, `{"result":"testOld"}`, 200)

	// Run query first time
	resp, err := zabbixClient.Request(context.Background(), query)

	assert.NoError(t, err)
	result, _ := resp.String()
	assert.Equal(t, "testOld", result)

	// Mock request with new value
	zabbixClient, _ = MockZabbixClientResponse(zabbixClient, `{"result":"testNew"}`, 200)
	// Should not run actual API query and return first result
	resp, err = zabbixClient.Request(context.Background(), query)

	assert.NoError(t, err)
	result, _ = resp.String()
	assert.Equal(t, "testOld", result)
}

func TestNonCachedQuery(t *testing.T) {
	// Using methods with caching disabled
	query := &ZabbixAPIRequest{Method: "history.get", Params: emptyParams}
	zabbixClient, _ := MockZabbixClient(basicDatasourceInfo, `{"result":"testOld"}`, 200)

	// Run query first time
	resp, err := zabbixClient.Request(context.Background(), query)

	assert.NoError(t, err)
	result, _ := resp.String()
	assert.Equal(t, "testOld", result)

	// Mock request with new value
	zabbixClient, _ = MockZabbixClientResponse(zabbixClient, `{"result":"testNew"}`, 200)
	// Should not run actual API query and return first result
	resp, err = zabbixClient.Request(context.Background(), query)

	assert.NoError(t, err)
	result, _ = resp.String()
	assert.Equal(t, "testNew", result)
}
