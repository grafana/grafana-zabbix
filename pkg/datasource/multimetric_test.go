package datasource

import (
	"context"
	"testing"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Patterns follow the plugin-wide filter convention: "/.../" is a regex, anything else must match
// the item name/key exactly. A plain string must NOT behave as a substring regex: "CPU utilization"
// must not match "Process X: CPU utilization".
func TestFilterItemsByPattern(t *testing.T) {
	ds := MockZabbixDataSource("", 200)

	items := []*zabbix.Item{
		{ID: "1", Name: "CPU utilization", Key: "system.cpu.util"},
		{ID: "2", Name: "Process X: CPU utilization", Key: "proc.cpu.util[X]"},
		{ID: "3", Name: "Memory utilization", Key: "vm.memory.util"},
	}

	t.Run("plain string matches item name exactly", func(t *testing.T) {
		filtered := ds.filterItemsByPattern(items, "CPU utilization", "itemName")
		require.Len(t, filtered, 1)
		assert.Equal(t, "1", filtered[0].ID)
	})

	t.Run("regex matches as substring", func(t *testing.T) {
		filtered := ds.filterItemsByPattern(items, "/CPU utilization/", "itemName")
		assert.Len(t, filtered, 2)
	})

	t.Run("plain string matches item key exactly", func(t *testing.T) {
		filtered := ds.filterItemsByPattern(items, "system.cpu.util", "itemKey")
		require.Len(t, filtered, 1)
		assert.Equal(t, "1", filtered[0].ID)
	})

	t.Run("empty pattern matches nothing", func(t *testing.T) {
		filtered := ds.filterItemsByPattern(items, "", "itemName")
		assert.Len(t, filtered, 0)
	})

	t.Run("invalid regex returns all items unfiltered", func(t *testing.T) {
		filtered := ds.filterItemsByPattern(items, "/([/", "itemName")
		assert.Len(t, filtered, 3)
	})
}

// Zabbix reports lastvalue "0" for items that never received a value; only lastclock == 0 tells
// them apart from a genuine zero. Such items must render as null, not 0.
func TestCollectedLastValue(t *testing.T) {
	zero := "0"
	value := "42"

	neverCollected := &zabbix.Item{LastValue: &zero, LastClock: 0}
	assert.Nil(t, neverCollected.CollectedLastValue(), "never-collected item must yield nil")

	genuineZero := &zabbix.Item{LastValue: &zero, LastClock: 1700000000}
	require.NotNil(t, genuineZero.CollectedLastValue())
	assert.Equal(t, "0", *genuineZero.CollectedLastValue(), "a real zero must be kept")

	collected := &zabbix.Item{LastValue: &value, LastClock: 1700000000}
	require.NotNil(t, collected.CollectedLastValue())
	assert.Equal(t, "42", *collected.CollectedLastValue())

	noValue := &zabbix.Item{LastValue: nil, LastClock: 1700000000}
	assert.Nil(t, noValue.CollectedLastValue())
}

// Tag columns are another way to build the metadata columns, so like extracted capture groups they
// identify the row: host plus every metadata value. Without any metadata the entity label does.
func TestEntityRowKey(t *testing.T) {
	assert.Equal(t, "host-a|Interface eth0: Bits received", entityRowKey("host-a", "Interface eth0: Bits received", nil, nil),
		"no metadata: the entity label identifies the row")
	assert.Equal(t, "host-a|eth0|WAN", entityRowKey("host-a", "eth0", []string{"eth0", "WAN"}, nil),
		"extracted capture groups identify the row")
	assert.Equal(t, "host-a|eth0", entityRowKey("host-a", "Interface eth0: Bits received", nil, []string{"eth0"}),
		"tag columns replace the entity label")
	assert.Equal(t, "host-a|eth0|network", entityRowKey("host-a", "eth0", []string{"eth0"}, []string{"network"}),
		"extracted values and tag values combine")
	assert.Equal(t, "host-a|", entityRowKey("host-a", "Interface lo: Bits received", nil, []string{""}),
		"an item without the tag groups into the empty-value row")
}

func TestItemTagValue(t *testing.T) {
	item := &zabbix.Item{Tags: []zabbix.Tag{{Tag: "interface", Value: "eth0"}, {Tag: "valueless"}}}
	assert.Equal(t, "eth0", itemTagValue(item, "interface"))
	assert.Equal(t, "", itemTagValue(item, "valueless"), "a tag without a value is empty")
	assert.Equal(t, "", itemTagValue(item, "missing"), "a missing tag is empty")
}

// End to end through queryMultiMetricTable: with tag columns and no capture regex, all items of an
// interface (Bits received, Bits sent) collapse into one row keyed by the tag value, metric values
// join on the same key, and the Entity column is not added.
func TestQueryMultiMetricTable_TagColumns(t *testing.T) {
	ds := MockZabbixDataSource("", 200)
	ds.zabbix = zabbix.NewZabbixClientWithHandler(t, func(payload zabbix.ApiRequestPayload) string {
		switch payload.Method {
		case "apiinfo.version":
			return `{"result":"7.0.0"}`
		case "hostgroup.get":
			return `{"result":[{"groupid":"1","name":"Routers"}]}`
		case "host.get":
			return `{"result":[{"hostid":"10","name":"router-a"}]}`
		case "item.get":
			return `{"result":[
				{"itemid":"1","name":"Interface eth0: Bits received","key_":"net.if.in[eth0]","value_type":"3","hostid":"10","lastvalue":"100","lastclock":"1700000000","hosts":[{"hostid":"10","name":"router-a"}],"tags":[{"tag":"interface","value":"eth0"}]},
				{"itemid":"2","name":"Interface eth0: Bits sent","key_":"net.if.out[eth0]","value_type":"3","hostid":"10","lastvalue":"200","lastclock":"1700000000","hosts":[{"hostid":"10","name":"router-a"}],"tags":[{"tag":"interface","value":"eth0"}]},
				{"itemid":"3","name":"Interface eth1: Bits received","key_":"net.if.in[eth1]","value_type":"3","hostid":"10","lastvalue":"300","lastclock":"1700000000","hosts":[{"hostid":"10","name":"router-a"}],"tags":[{"tag":"interface","value":"eth1"}]},
				{"itemid":"4","name":"Interface eth1: Bits sent","key_":"net.if.out[eth1]","value_type":"3","hostid":"10","lastvalue":"400","lastclock":"1700000000","hosts":[{"hostid":"10","name":"router-a"}],"tags":[{"tag":"interface","value":"eth1"}]},
				{"itemid":"5","name":"Interface lo: Bits received","key_":"net.if.in[lo]","value_type":"3","hostid":"10","lastvalue":"500","lastclock":"1700000000","hosts":[{"hostid":"10","name":"router-a"}]}
			]}`
		}
		return `{"result":null}`
	})

	query := &QueryModel{
		RefID:     "A",
		QueryType: MODE_MULTIMETRIC_TABLE,
		Group:     QueryFilter{Filter: "Routers"},
		Host:      QueryFilter{Filter: "/.*/"},
		TableConfig: &MultiMetricTableConfig{
			EntityPattern: EntityPatternConfig{
				SearchType: "itemName",
				Pattern:    "/^Interface /",
				TagColumns: []TagColumnConfig{{Name: "Interface", Tag: "interface"}},
			},
			Metrics: []MetricColumnConfig{
				{ColumnName: "Bits in", SearchType: "itemName", Pattern: "/Bits received$/", Aggregation: "last"},
				{ColumnName: "Bits out", SearchType: "itemName", Pattern: "/Bits sent$/", Aggregation: "last"},
			},
		},
	}

	frames, err := ds.queryMultiMetricTable(context.Background(), query)
	require.NoError(t, err)
	require.Len(t, frames, 1)

	frame := frames[0]
	names := make([]string, len(frame.Fields))
	for i, f := range frame.Fields {
		names[i] = f.Name
	}
	assert.Equal(t, []string{"Interface", "Bits in", "Bits out"}, names, "tag column, no Entity column, single host so no Host column")
	require.Equal(t, 3, frame.Rows())

	str := func(v interface{}) interface{} {
		if p, ok := v.(*string); ok {
			if p == nil {
				return nil
			}
			return *p
		}
		return v
	}
	rows := make([][]interface{}, frame.Rows())
	for r := range rows {
		for _, f := range frame.Fields {
			rows[r] = append(rows[r], str(f.At(r)))
		}
	}
	assert.Equal(t, []interface{}{"eth0", "100", "200"}, rows[0])
	assert.Equal(t, []interface{}{"eth1", "300", "400"}, rows[1])
	assert.Equal(t, []interface{}{"", "500", nil}, rows[2], "the untagged item lands in its own row with an empty tag value")
}

func TestTagColumnName(t *testing.T) {
	assert.Equal(t, "Interface", TagColumnConfig{Name: "Interface", Tag: "interface"}.ColumnName())
	assert.Equal(t, "interface", TagColumnConfig{Tag: "interface"}.ColumnName(), "falls back to the tag name")
}
