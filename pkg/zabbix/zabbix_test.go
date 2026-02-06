package zabbix

import (
	"context"
	"testing"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"

	"github.com/stretchr/testify/assert"
)

var emptyParams = map[string]interface{}{}

func TestLogin(t *testing.T) {
	zabbixClient, _ := MockZabbixClient(BasicDatasourceInfo, `{"result":"secretauth"}`, 200)
	err := zabbixClient.Authenticate(context.Background())

	assert.NoError(t, err)
	assert.Equal(t, "secretauth", zabbixClient.api.GetAuth())
}

func TestLoginError(t *testing.T) {
	zabbixClient, _ := MockZabbixClient(BasicDatasourceInfo, `{"result":""}`, 500)
	err := zabbixClient.Authenticate(context.Background())

	assert.Error(t, err)
	assert.Equal(t, "", zabbixClient.api.GetAuth())
}

func TestZabbixAPIQuery(t *testing.T) {
	zabbixClient, _ := MockZabbixClient(BasicDatasourceInfo, `{"result":"test"}`, 200)
	resp, err := zabbixClient.Request(context.Background(), &ZabbixAPIRequest{Method: "test.get", Params: emptyParams})

	assert.NoError(t, err)

	result, err := resp.String()
	assert.NoError(t, err)
	assert.Equal(t, "test", result)
}

func TestCachedQuery(t *testing.T) {
	// Using methods with caching enabled
	query := &ZabbixAPIRequest{Method: "host.get", Params: emptyParams}
	zabbixClient, _ := MockZabbixClient(BasicDatasourceInfo, `{"result":"testOld"}`, 200)

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
	zabbixClient, _ := MockZabbixClient(BasicDatasourceInfo, `{"result":"testOld"}`, 200)

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

func TestItemTagCache(t *testing.T) {
	callCount := 0
	zabbixClient := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
		switch payload.Method {
		case "apiinfo.version":
			return `{"result":"6.4.0"}`
		case "item.get":
			callCount++
			if callCount == 1 {
				return `{"result":[{"itemid":"1","name":"test1"}]}`
			}
			return `{"result":[{"itemid":"2","name":"test2"}]}`
		default:
			return `{"result":null}`
		}
	})
	// tag filtering is on >= 54 version
	zabbixClient.settings.AuthType = settings.AuthTypeToken
	items, err := zabbixClient.GetAllItems(
		context.Background(),
		nil,
		nil,
		"num",
		false,
		"Application: test, interface: test",
		false, // do not select last value
	)

	assert.NoError(t, err)
	if assert.Len(t, items, 1) {
		item := items[0]
		assert.Equal(t, "1", item.ID)
		assert.Equal(t, "test1", item.Name)
	}

	zabbixClient, _ = MockZabbixClientResponse(
		zabbixClient,
		// intentionally different response to test if the cache hits
		`{"result":[{"itemid":"2","name":"test2"}]}`,
		200,
	)
	zabbixClient.api.SetAuth("test")
	items, err = zabbixClient.GetAllItems(
		context.Background(),
		nil,
		nil,
		"num",
		false,
		// change tag order
		"interface: test, Application: test",
		false, // do not select last value
	)

	assert.NoError(t, err)
	if assert.Len(t, items, 1) {
		item := items[0]
		// test if it still uses cached response
		assert.Equal(t, "1", item.ID)
		assert.Equal(t, "test1", item.Name)
	}
}
