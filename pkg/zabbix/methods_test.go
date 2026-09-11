package zabbix

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetFullVersion(t *testing.T) {
	zabbixClient, err := MockZabbixClient(BasicDatasourceInfo, `{"result":"5.0.12"}`, 200)
	require.NoError(t, err)

	version, err := zabbixClient.GetFullVersion(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, "5.0.12", version)
}

func TestGetFullVersionInvalidPayload(t *testing.T) {
	zabbixClient, err := MockZabbixClient(BasicDatasourceInfo, `{"result":{"version":"5.0.12"}}`, 200)
	require.NoError(t, err)

	version, err := zabbixClient.GetFullVersion(context.Background())
	assert.Error(t, err)
	assert.Equal(t, "", version)
}

func TestGetVersion(t *testing.T) {
	zabbixClient, err := MockZabbixClient(BasicDatasourceInfo, `{"result":"5.4.3"}`, 200)
	require.NoError(t, err)

	version, err := zabbixClient.GetVersion(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, 54, version)
}

func TestGetVersionReturnsError(t *testing.T) {
	zabbixClient, err := MockZabbixClient(BasicDatasourceInfo, `{"result":"a.b.c"}`, 200)
	require.NoError(t, err)

	version, err := zabbixClient.GetVersion(context.Background())
	assert.Error(t, err)
	assert.Equal(t, 0, version)
}

func TestGetHistory(t *testing.T) {
	var historyCalls []int
	client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
		if payload.Method == "history.get" {
			historyCalls = append(historyCalls, int(payload.Params["history"].(float64)))
			return `{"result":[{"itemid":"1","clock":"1","value":"1.2","ns":"0"}]}`
		}
		if payload.Method == "apiinfo.version" {
			return `{"result":"6.4.0"}`
		}
		return `{"result":null}`
	})

	items := []*Item{
		{ID: "10", ValueType: 0},
		{ID: "20", ValueType: 3},
	}
	tr := backend.TimeRange{
		From: time.Unix(0, 0),
		To:   time.Unix(10, 0),
	}

	history, err := client.GetHistory(context.Background(), items, tr)
	require.NoError(t, err)
	assert.Len(t, history, 2)
	assert.ElementsMatch(t, []int{0, 3}, historyCalls)
}

func TestGetTrend(t *testing.T) {
	var capturedIDs []string
	client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
		if payload.Method == "trend.get" {
			for _, raw := range payload.Params["itemids"].([]interface{}) {
				capturedIDs = append(capturedIDs, raw.(string))
			}
			return `{"result":[{"itemid":"1","clock":"1","value_min":"0","value_avg":"1","value_max":"2"}]}`
		}

		if payload.Method == "apiinfo.version" {
			return `{"result":"6.4.0"}`
		}
		return `{"result":null}`
	})

	items := []*Item{{ID: "100"}, {ID: "200"}}
	tr := backend.TimeRange{
		From: time.Unix(0, 0),
		To:   time.Unix(10, 0),
	}

	trend, err := client.GetTrend(context.Background(), items, tr)
	require.NoError(t, err)
	assert.Len(t, trend, 1)
	assert.ElementsMatch(t, []string{"100", "200"}, capturedIDs)
}

func TestGetItems(t *testing.T) {
	client := NewZabbixClientWithResponses(t, map[string]string{
		"hostgroup.get": `{"result":[{"groupid":"1","name":"Servers"}]}`,
		"host.get":      `{"result":[{"hostid":"10","name":"web01"}]}`,
		"item.get": `{
			"result":[
				{"itemid":"100","name":"CPU usage"},
				{"itemid":"200","name":"Memory usage"}
			]
		}`,
		"apiinfo.version": `{"result":"6.4.0"}`,
	})

	items, err := client.GetItems(context.Background(), "Servers", "web01", "", "/CPU/", "num", false)
	require.NoError(t, err)
	if assert.Len(t, items, 1) {
		assert.Equal(t, "100", items[0].ID)
	}
}

func TestGetItemsWithRegexItemTagFilterNoMatch(t *testing.T) {
	// Test that when a regex itemTagFilter doesn't match any tags,
	// GetItems returns an empty list instead of all items.
	// 
	// This test verifies the fix for the bug where an empty tag filter result
	// would cause itemTagFilter to become empty string, silently removing the filter.
	//
	// Bug scenario (without fix):
	// 1. Regex itemTagFilter "/^NonExistentTag/" doesn't match any tags
	// 2. GetItemTags returns empty list
	// 3. itemTagFilter becomes "" (empty string) 
	// 4. GetAllItems is called with empty itemTagFilter → returns ALL items (no tag filtering)
	// 5. filterItemsByQuery filters by itemFilter "/.*/" → returns all 2 items
	//
	// Fixed scenario (with fix):
	// 1. Regex itemTagFilter "/^NonExistentTag/" doesn't match any tags
	// 2. GetItemTags returns empty list
	// 3. Early return with empty items list → returns 0 items
	itemGetCalls := []map[string]interface{}{}
	client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
		if payload.Method == "item.get" {
			// Track all item.get calls to verify behavior
			paramsCopy := make(map[string]interface{})
			for k, v := range payload.Params {
				paramsCopy[k] = v
			}
			itemGetCalls = append(itemGetCalls, paramsCopy)
			
			// Return items that would be returned if no tag filter is applied
			return `{
				"result":[
					{"itemid":"100","name":"CPU usage","tags":[{"tag":"Env","value":"prod"}]},
					{"itemid":"200","name":"Memory usage","tags":[{"tag":"Application","value":"api"}]}
				]
			}`
		}
		if payload.Method == "hostgroup.get" {
			return `{"result":[{"groupid":"1","name":"Servers"}]}`
		}
		if payload.Method == "host.get" {
			return `{"result":[{"hostid":"10","name":"web01"}]}`
		}
		if payload.Method == "apiinfo.version" {
			return `{"result":"6.4.0"}`
		}
		return `{"result":null}`
	})

	// Use a regex itemTagFilter that won't match any tags
	// Use itemFilter "/.*/" which matches all items, so we can detect if bug returns all items
	items, err := client.GetItems(context.Background(), "Servers", "web01", "/^NonExistentTag/", "/.*/", "num", false)
	require.NoError(t, err)
	
	// With fix: Should return empty list (0 items) because no tags matched
	// Without fix: Would return 2 items because itemTagFilter becomes empty and GetAllItems returns all items
	if len(items) != 0 {
		t.Errorf("Expected empty list when regex itemTagFilter matches no tags, but got %d items. This indicates the bug: itemTagFilter was silently removed and all items were returned.", len(items))
		t.Logf("Item.get was called %d times", len(itemGetCalls))
		for i, call := range itemGetCalls {
			tags, hasTags := call["tags"]
			if hasTags {
				t.Logf("Call %d: has tags filter: %v", i+1, tags)
			} else {
				t.Logf("Call %d: NO tags filter (this is the bug - should not call GetAllItems with empty filter)", i+1)
			}
		}
	}
	assert.Len(t, items, 0, "Expected empty list when regex itemTagFilter matches no tags. Without fix, this would return 2 items.")
}

func TestGetItemsBefore54(t *testing.T) {
	client := NewZabbixClientWithResponses(t, map[string]string{
		"hostgroup.get": `{"result":[{"groupid":"1","name":"Servers"}]}`,
		"host.get":      `{"result":[{"hostid":"10","name":"web01"}]}`,
		"application.get": `{
			"result":[
				{"applicationid":"50","name":"Databases"},
				{"applicationid":"60","name":"Apps"}
			]
		}`,
		"item.get": `{
			"result":[
				{"itemid":"500","name":"DB Size"},
				{"itemid":"600","name":"API latency"}
			]
		}`,
		"apiinfo.version": `{"result":"5.0.0"}`,
	})

	items, err := client.GetItemsBefore54(context.Background(), "Servers", "web01", "Databases", "/DB/", "num", false)
	require.NoError(t, err)
	if assert.Len(t, items, 1) {
		assert.Equal(t, "500", items[0].ID)
	}
}

func TestFilterItemsByQuery(t *testing.T) {
	items := []*Item{
		{Name: "CPU usage"},
		{Name: "Memory usage"},
	}

	filtered, err := filterItemsByQuery(items, "/CPU/")
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "CPU usage", filtered[0].Name)

	filtered, err = filterItemsByQuery(items, "Memory usage")
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "Memory usage", filtered[0].Name)
}

func TestGetApps(t *testing.T) {
	client := NewZabbixClientWithResponses(t, map[string]string{
		"hostgroup.get": `{"result":[{"groupid":"1","name":"Servers"}]}`,
		"host.get":      `{"result":[{"hostid":"10","name":"web01"}]}`,
		"application.get": `{
			"result":[
				{"applicationid":"50","name":"API"},
				{"applicationid":"60","name":"DB"}
			]
		}`,
		"apiinfo.version": `{"result":"6.4.0"}`,
	})

	apps, err := client.GetApps(context.Background(), "Servers", "web01", "/^API/")
	require.NoError(t, err)
	if assert.Len(t, apps, 1) {
		assert.Equal(t, "50", apps[0].ID)
	}
}

func TestFilterAppsByQuery(t *testing.T) {
	apps := []Application{
		{Name: "API"},
		{Name: "DB"},
	}

	filtered, err := filterAppsByQuery(apps, "/^A/")
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "API", filtered[0].Name)

	filtered, err = filterAppsByQuery(apps, "DB")
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "DB", filtered[0].Name)
}

func TestGetItemTags(t *testing.T) {
	client := NewZabbixClientWithResponses(t, map[string]string{
		"hostgroup.get": `{"result":[{"groupid":"1","name":"Servers"}]}`,
		"host.get":      `{"result":[{"hostid":"10","name":"web01"}]}`,
		"item.get": `{
			"result":[
				{"itemid":"1","name":"CPU","tags":[{"tag":"Env","value":"prod"},{"tag":"Application","value":"api"}]},
				{"itemid":"2","name":"Mem","tags":[{"tag":"Env","value":"stage"},{"tag":"Env","value":"prod"}]}
			]
		}`,
		"apiinfo.version": `{"result":"6.4.0"}`,
	})

	tags, err := client.GetItemTags(context.Background(), "Servers", "web01", "/^Env/")
	require.NoError(t, err)
	assert.ElementsMatch(t, []Tag{
		{Tag: "Env", Value: "prod"},
		{Tag: "Env", Value: "stage"},
	}, tags)
}

func TestFilterTags(t *testing.T) {
	tags := []Tag{
		{Tag: "Env", Value: "prod"},
		{Tag: "Application", Value: "api"},
	}

	filtered, err := filterTags(tags, "/^Env/")
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "Env", filtered[0].Tag)

	filtered, err = filterTags(tags, "Application: api")
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "Application", filtered[0].Tag)
}

func TestGetHosts(t *testing.T) {
	client := NewZabbixClientWithResponses(t, map[string]string{
		"hostgroup.get": `{"result":[{"groupid":"1","name":"Servers"}]}`,
		"host.get": `{
			"result":[
				{"hostid":"10","name":"web01"},
				{"hostid":"20","name":"db01"}
			]
		}`,
		"apiinfo.version": `{"result":"6.4.0"}`,
	})

	hosts, err := client.GetHosts(context.Background(), "Servers", "/web/")
	require.NoError(t, err)
	if assert.Len(t, hosts, 1) {
		assert.Equal(t, "web01", hosts[0].Name)
	}
}

func TestFilterHostsByQuery(t *testing.T) {
	hosts := []Host{
		{Name: "web01"},
		{Name: "db01"},
	}

	filtered, err := filterHostsByQuery(hosts, "/^web/")
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "web01", filtered[0].Name)

	filtered, err = filterHostsByQuery(hosts, "db01")
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "db01", filtered[0].Name)
}

func TestGetGroups(t *testing.T) {
	client := NewZabbixClientWithResponses(t, map[string]string{
		"hostgroup.get":   `{"result":[{"groupid":"1","name":"Servers"},{"groupid":"2","name":"Apps"}]}`,
		"apiinfo.version": `{"result":"6.4.0"}`,
	})

	groups, err := client.GetGroups(context.Background(), "/Apps/")
	require.NoError(t, err)
	if assert.Len(t, groups, 1) {
		assert.Equal(t, "Apps", groups[0].Name)
	}
}

func TestFilterGroupsByQuery(t *testing.T) {
	groups := []Group{
		{Name: "Servers"},
		{Name: "Apps"},
	}

	filtered, err := filterGroupsByQuery(groups, "/Apps/")
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "Apps", filtered[0].Name)

	filtered, err = filterGroupsByQuery(groups, "Servers")
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "Servers", filtered[0].Name)
}

func TestGetAllItemsBuildsParams(t *testing.T) {
	var lastRequest ApiRequestPayload
	client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
		if payload.Method == "item.get" {
			lastRequest = payload
			return `{"result":[{"itemid":"1","name":"CPU $1","key_":"system.cpu[user]","value_type":"0","hosts":[{"hostid":"10","name":"web"}]}]}`
		}

		if payload.Method == "apiinfo.version" {
			return `{"result":"6.4.0"}`
		}

		return `{"result":null}`
	})

	items, err := client.GetAllItems(
		context.Background(),
		[]string{"10"},
		nil,
		"num",
		false,
		"Env: prod, Application: api",
		false, // do not select last value
	)
	require.NoError(t, err)
	if assert.Len(t, items, 1) {
		assert.Equal(t, "CPU user", items[0].Name)
	}

	require.Equal(t, "item.get", lastRequest.Method)
	params := lastRequest.Params
	assert.Equal(t, []interface{}{"10"}, params["hostids"])
	assert.Equal(t, true, params["monitored"])
	filter := params["filter"].(map[string]interface{})
	assert.ElementsMatch(t, []interface{}{float64(0), float64(3)}, filter["value_type"].([]interface{}))
	tags := params["tags"].([]interface{})
	if assert.Len(t, tags, 2) {
		first := tags[0].(map[string]interface{})
		second := tags[1].(map[string]interface{})
		assert.Equal(t, "Application", first["tag"])
		assert.Equal(t, "Env", second["tag"])
	}
}

func TestGetItemsByIDs(t *testing.T) {
	var lastRequest ApiRequestPayload
	client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
		if payload.Method == "item.get" {
			lastRequest = payload
			return `{"result":[{"itemid":"1","name":"CPU"}]}`
		}

		if payload.Method == "apiinfo.version" {
			return `{"result":"6.4.0"}`
		}

		return `{"result":null}`
	})

	items, err := client.GetItemsByIDs(context.Background(), []string{"1"})
	require.NoError(t, err)
	assert.Len(t, items, 1)
	assert.Equal(t, []interface{}{"1"}, lastRequest.Params["itemids"].([]interface{}))
}

func TestGetAllApps(t *testing.T) {
	client := NewZabbixClientWithResponses(t, map[string]string{
		"application.get": `{"result":[{"applicationid":"10","name":"API"}]}`,
		"apiinfo.version": `{"result":"6.4.0"}`,
	})

	apps, err := client.GetAllApps(context.Background(), []string{"1"})
	require.NoError(t, err)
	assert.Len(t, apps, 1)
	assert.Equal(t, "API", apps[0].Name)
}

func TestGetAllHosts(t *testing.T) {
	client := NewZabbixClientWithResponses(t, map[string]string{
		"host.get":        `{"result":[{"hostid":"10","name":"web01"}]}`,
		"apiinfo.version": `{"result":"6.4.0"}`,
	})

	hosts, err := client.GetAllHosts(context.Background(), []string{"1"})
	require.NoError(t, err)
	assert.Len(t, hosts, 1)
	assert.Equal(t, "web01", hosts[0].Name)
}

func TestGetAllGroups(t *testing.T) {
	client := NewZabbixClientWithResponses(t, map[string]string{
		"hostgroup.get":   `{"result":[{"groupid":"1","name":"Servers"}]}`,
		"apiinfo.version": `{"result":"6.4.0"}`,
	})

	groups, err := client.GetAllGroups(context.Background())
	require.NoError(t, err)
	assert.Len(t, groups, 1)
	assert.Equal(t, "Servers", groups[0].Name)
}

func TestGetValueMappings(t *testing.T) {
	client := NewZabbixClientWithResponses(t, map[string]string{
		"valuemap.get": `{
			"result":[
				{
					"valuemapid":"1",
					"name":"Status",
					"mappings":[{"value":"0","newvalue":"down"}]
				}
			]
		}`,
		"apiinfo.version": `{"result":"6.4.0"}`,
	})

	valueMaps, err := client.GetValueMappings(context.Background())
	require.NoError(t, err)
	assert.Len(t, valueMaps, 1)
	assert.Equal(t, "Status", valueMaps[0].Name)
}
