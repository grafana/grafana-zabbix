package zabbix

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// item.get is cached for the data source cache TTL because it normally returns item metadata.
// A request that also asks for lastvalue/lastclock carries live metric values and must reach
// Zabbix every time, otherwise the Multi-metric table would show values up to one TTL old.
func TestGetAllItems_LastValueIsNeverServedFromCache(t *testing.T) {
	itemGetCalls := 0
	lastValue := "10"
	client := NewZabbixClientWithHandler(t, func(payload ApiRequestPayload) string {
		switch payload.Method {
		case "apiinfo.version":
			return `{"result":"7.0.0"}`
		case "item.get":
			itemGetCalls++
			return fmt.Sprintf(
				`{"result":[{"itemid":"1","name":"CPU utilization","key_":"system.cpu.util","value_type":"0","hostid":"10","status":"0","lastvalue":"%s","lastclock":"1700000000","hosts":[{"hostid":"10","name":"host-a"}]}]}`,
				lastValue,
			)
		default:
			return `{"result":null}`
		}
	})
	ctx := context.Background()

	t.Run("with lastvalue every call reaches Zabbix and returns the current value", func(t *testing.T) {
		items, err := client.GetAllItems(ctx, []string{"10"}, nil, "num", false, "", true)
		require.NoError(t, err)
		require.Len(t, items, 1)
		require.NotNil(t, items[0].LastValue)
		assert.Equal(t, "10", *items[0].LastValue)
		assert.Equal(t, 1, itemGetCalls)

		lastValue = "42"
		items, err = client.GetAllItems(ctx, []string{"10"}, nil, "num", false, "", true)
		require.NoError(t, err)
		require.Len(t, items, 1)
		require.NotNil(t, items[0].LastValue)
		assert.Equal(t, "42", *items[0].LastValue, "a changed value must be visible on the next query")
		assert.Equal(t, 2, itemGetCalls)
	})

	t.Run("without lastvalue item metadata is still cached", func(t *testing.T) {
		before := itemGetCalls

		_, err := client.GetAllItems(ctx, []string{"10"}, nil, "num", false, "", false)
		require.NoError(t, err)
		assert.Equal(t, before+1, itemGetCalls, "first metadata request hits Zabbix")

		_, err = client.GetAllItems(ctx, []string{"10"}, nil, "num", false, "", false)
		require.NoError(t, err)
		assert.Equal(t, before+1, itemGetCalls, "repeat metadata request is served from cache")
	})
}
