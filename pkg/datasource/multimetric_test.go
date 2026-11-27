package datasource

import (
	"context"
	"testing"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
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
		filtered, err := ds.filterItemsByPattern(items, "CPU utilization", "itemName")
		require.NoError(t, err)
		require.Len(t, filtered, 1)
		assert.Equal(t, "1", filtered[0].ID)
	})

	t.Run("regex matches as substring", func(t *testing.T) {
		filtered, err := ds.filterItemsByPattern(items, "/CPU utilization/", "itemName")
		require.NoError(t, err)
		assert.Len(t, filtered, 2)
	})

	t.Run("plain string matches item key exactly", func(t *testing.T) {
		filtered, err := ds.filterItemsByPattern(items, "system.cpu.util", "itemKey")
		require.NoError(t, err)
		require.Len(t, filtered, 1)
		assert.Equal(t, "1", filtered[0].ID)
	})

	t.Run("empty pattern matches nothing", func(t *testing.T) {
		filtered, err := ds.filterItemsByPattern(items, "", "itemName")
		require.NoError(t, err)
		assert.Len(t, filtered, 0)
	})

	t.Run("regex flags apply as in other filters", func(t *testing.T) {
		filtered, err := ds.filterItemsByPattern(items, "/cpu utilization/i", "itemName")
		require.NoError(t, err)
		assert.Len(t, filtered, 2)
	})

	t.Run("lookahead is supported as in other filters", func(t *testing.T) {
		filtered, err := ds.filterItemsByPattern(items, "/^(?!Process).*utilization/", "itemName")
		require.NoError(t, err)
		require.Len(t, filtered, 2)
		assert.Equal(t, "1", filtered[0].ID)
		assert.Equal(t, "3", filtered[1].ID)
	})

	t.Run("invalid regex returns an error", func(t *testing.T) {
		for _, pattern := range []string{"/([/", "/*cpu/i"} {
			filtered, err := ds.filterItemsByPattern(items, pattern, "itemName")
			require.Error(t, err, pattern)
			assert.Nil(t, filtered, pattern)
			assert.Contains(t, err.Error(), pattern)
			assert.True(t, backend.IsDownstreamError(err), pattern)
		}
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

// An invalid regex must fail the query instead of silently matching every item. The extract pattern
// uses Go's RE2, where a lookahead is invalid.
func TestQueryMultiMetricTable_InvalidPatternFails(t *testing.T) {
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
				{"itemid":"1","name":"Interface eth0: Bits received","key_":"net.if.in[eth0]","value_type":"3","hostid":"10","lastvalue":"100","lastclock":"1700000000","hosts":[{"hostid":"10","name":"router-a"}]},
				{"itemid":"2","name":"Interface eth0: Bits sent","key_":"net.if.out[eth0]","value_type":"3","hostid":"10","lastvalue":"200","lastclock":"1700000000","hosts":[{"hostid":"10","name":"router-a"}]}
			]}`
		}
		return `{"result":null}`
	})

	tests := []struct {
		name           string
		entityPattern  string
		extractPattern string
		metricPattern  string
		wantInError    []string
	}{
		{
			name:           "table rows pattern",
			entityPattern:  "/^Interface ([/",
			extractPattern: `Interface (.*): .*`,
			metricPattern:  "/Bits received$/",
			wantInError:    []string{`table rows pattern "/^Interface ([/"`},
		},
		{
			name:           "metric column pattern",
			entityPattern:  "/^Interface /",
			extractPattern: `Interface (.*): .*`,
			metricPattern:  "/Bits ([/",
			wantInError:    []string{`metric column "In": pattern "/Bits ([/"`},
		},
		{
			name:           "extract pattern",
			entityPattern:  "/^Interface /",
			extractPattern: `Interface (?!lo)(.*): .*`,
			metricPattern:  "/Bits received$/",
			wantInError:    []string{`extract pattern "Interface (?!lo)(.*): .*"`},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := &QueryModel{
				RefID:     "A",
				QueryType: MODE_MULTIMETRIC_TABLE,
				Group:     QueryFilter{Filter: "Routers"},
				Host:      QueryFilter{Filter: "/.*/"},
				TableConfig: &MultiMetricTableConfig{
					EntityPattern: EntityPatternConfig{
						SearchType:     "itemName",
						Pattern:        tt.entityPattern,
						ExtractPattern: tt.extractPattern,
					},
					Metrics: []MetricColumnConfig{
						{ColumnName: "In", SearchType: "itemName", Pattern: tt.metricPattern, Aggregation: "last"},
					},
				},
			}

			frames, err := ds.queryMultiMetricTable(context.Background(), query)
			require.Error(t, err)
			assert.Nil(t, frames)
			assert.True(t, backend.IsDownstreamError(err), "an invalid pattern is a user error")
			for _, want := range tt.wantInError {
				assert.Contains(t, err.Error(), want)
			}
		})
	}
}

// The editor hides the extract pattern for host rows, so an invalid value left over from Item
// pattern mode must not fail a host-rows query.
func TestQueryMultiMetricTable_HostRowsIgnoreExtractPattern(t *testing.T) {
	ds := MockZabbixDataSource("", 200)
	ds.zabbix = zabbix.NewZabbixClientWithHandler(t, func(payload zabbix.ApiRequestPayload) string {
		switch payload.Method {
		case "apiinfo.version":
			return `{"result":"7.0.0"}`
		case "hostgroup.get":
			return `{"result":[{"groupid":"1","name":"Linux servers"}]}`
		case "host.get":
			return `{"result":[{"hostid":"10","name":"web01"}]}`
		case "item.get":
			return `{"result":[
				{"itemid":"1","name":"CPU utilization","key_":"system.cpu.util","value_type":"0","hostid":"10","lastvalue":"12.5","lastclock":"1700000000","hosts":[{"hostid":"10","name":"web01"}]}
			]}`
		}
		return `{"result":null}`
	})

	query := &QueryModel{
		RefID:     "A",
		QueryType: MODE_MULTIMETRIC_TABLE,
		Group:     QueryFilter{Filter: "Linux servers"},
		Host:      QueryFilter{Filter: "/.*/"},
		TableConfig: &MultiMetricTableConfig{
			RowSource:     "host",
			EntityPattern: EntityPatternConfig{ExtractPattern: `Interface (?!lo)(.*): .*`},
			Metrics: []MetricColumnConfig{
				{ColumnName: "CPU", SearchType: "itemName", Pattern: "CPU utilization", Aggregation: "last"},
			},
		},
	}

	frames, err := ds.queryMultiMetricTable(context.Background(), query)
	require.NoError(t, err)
	require.Len(t, frames, 1)
	assert.Equal(t, 1, frames[0].Rows())
}

// A failed history request must fail the query instead of dropping the column from the table.
func TestQueryMultiMetricTable_HistoryErrorFails(t *testing.T) {
	ds := MockZabbixDataSource("", 200)
	ds.zabbix = zabbix.NewZabbixClientWithHandler(t, func(payload zabbix.ApiRequestPayload) string {
		switch payload.Method {
		case "apiinfo.version":
			return `{"result":"7.0.0"}`
		case "hostgroup.get":
			return `{"result":[{"groupid":"1","name":"Linux servers"}]}`
		case "host.get":
			return `{"result":[{"hostid":"10","name":"web01"}]}`
		case "item.get":
			return `{"result":[
				{"itemid":"1","name":"CPU utilization","key_":"system.cpu.util","value_type":"0","hostid":"10","lastvalue":"12.5","lastclock":"1700000000","hosts":[{"hostid":"10","name":"web01"}]}
			]}`
		case "history.get":
			return `{"error":{"code":-32500,"message":"Application error.","data":"history backend unavailable"}}`
		}
		return `{"result":null}`
	})

	tests := []struct {
		name   string
		metric MetricColumnConfig
	}{
		{
			name:   "aggregation",
			metric: MetricColumnConfig{ColumnName: "CPU", SearchType: "itemName", Pattern: "CPU utilization", Aggregation: "avg"},
		},
		{
			name:   "sparkline",
			metric: MetricColumnConfig{ColumnName: "CPU", SearchType: "itemName", Pattern: "CPU utilization", ShowSparkline: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := &QueryModel{
				RefID:     "A",
				QueryType: MODE_MULTIMETRIC_TABLE,
				Group:     QueryFilter{Filter: "Linux servers"},
				Host:      QueryFilter{Filter: "/.*/"},
				TableConfig: &MultiMetricTableConfig{
					RowSource: "host",
					Metrics:   []MetricColumnConfig{tt.metric},
				},
			}

			frames, err := ds.queryMultiMetricTable(context.Background(), query)
			require.Error(t, err)
			assert.Nil(t, frames)
			assert.Contains(t, err.Error(), `metric column "CPU"`)
			assert.Contains(t, err.Error(), "history backend unavailable")
		})
	}
}

// The Group column shows the host's groups that match the Group filter, not the filter text.
func TestQueryMultiMetricTable_GroupColumn(t *testing.T) {
	var groupidsAsked interface{}
	ds := MockZabbixDataSource("", 200)
	ds.zabbix = zabbix.NewZabbixClientWithHandler(t, func(payload zabbix.ApiRequestPayload) string {
		switch payload.Method {
		case "apiinfo.version":
			return `{"result":"7.0.0"}`
		case "hostgroup.get":
			if _, withHosts := payload.Params["selectHosts"]; withHosts {
				groupidsAsked = payload.Params["groupids"]
				return `{"result":[
					{"groupid":"1","name":"Linux servers","hosts":[{"hostid":"10"},{"hostid":"11"}]},
					{"groupid":"2","name":"Linux web","hosts":[{"hostid":"10"}]}
				]}`
			}
			return `{"result":[{"groupid":"1","name":"Linux servers"},{"groupid":"2","name":"Linux web"},{"groupid":"3","name":"Other"}]}`
		case "host.get":
			return `{"result":[{"hostid":"10","name":"web01"},{"hostid":"11","name":"db01"}]}`
		case "item.get":
			return `{"result":[
				{"itemid":"1","name":"CPU utilization","key_":"system.cpu.util","value_type":"0","hostid":"10","lastvalue":"12.5","lastclock":"1700000000","hosts":[{"hostid":"10","name":"web01"}]},
				{"itemid":"2","name":"CPU utilization","key_":"system.cpu.util","value_type":"0","hostid":"11","lastvalue":"40","lastclock":"1700000000","hosts":[{"hostid":"11","name":"db01"}]}
			]}`
		}
		return `{"result":null}`
	})

	query := &QueryModel{
		RefID:     "A",
		QueryType: MODE_MULTIMETRIC_TABLE,
		Group:     QueryFilter{Filter: "/^Linux/"},
		Host:      QueryFilter{Filter: "/.*/"},
		TableConfig: &MultiMetricTableConfig{
			RowSource:       "host",
			ShowGroupColumn: true,
			Metrics: []MetricColumnConfig{
				{ColumnName: "CPU", SearchType: "itemName", Pattern: "CPU utilization", Aggregation: "last"},
			},
		},
	}

	frames, err := ds.queryMultiMetricTable(context.Background(), query)
	require.NoError(t, err)
	require.Len(t, frames, 1)
	frame := frames[0]
	require.Equal(t, "Group", frame.Fields[0].Name)
	require.Equal(t, "Host", frame.Fields[1].Name)
	// Host rows are sorted by name: db01, then web01.
	assert.Equal(t, "Linux servers", frame.Fields[0].At(0))
	assert.Equal(t, "Linux servers, Linux web", frame.Fields[0].At(1))
	assert.ElementsMatch(t, []interface{}{"1", "2"}, groupidsAsked, "only the groups matching the filter are asked for")
}

// When several items map to one row, each cell keeps the first item that has a value (a not yet
// collected item must not blank it) and the frame carries a warning.
func TestQueryMultiMetricTable_RowCollisionKeepsFirstValue(t *testing.T) {
	ds := MockZabbixDataSource("", 200)
	ds.zabbix = zabbix.NewZabbixClientWithHandler(t, func(payload zabbix.ApiRequestPayload) string {
		switch payload.Method {
		case "apiinfo.version":
			return `{"result":"7.0.0"}`
		case "hostgroup.get":
			return `{"result":[{"groupid":"1","name":"Linux servers"}]}`
		case "host.get":
			return `{"result":[{"hostid":"10","name":"web01"}]}`
		case "item.get":
			return `{"result":[
				{"itemid":"1","name":"CPU #0 utilization","key_":"cpu.util[0]","value_type":"0","hostid":"10","lastvalue":"0","lastclock":"0","hosts":[{"hostid":"10","name":"web01"}]},
				{"itemid":"2","name":"CPU #1 utilization","key_":"cpu.util[1]","value_type":"0","hostid":"10","lastvalue":"10","lastclock":"1700000000","hosts":[{"hostid":"10","name":"web01"}]},
				{"itemid":"3","name":"CPU #2 utilization","key_":"cpu.util[2]","value_type":"0","hostid":"10","lastvalue":"20","lastclock":"1700000000","hosts":[{"hostid":"10","name":"web01"}]},
				{"itemid":"4","name":"CPU #3 utilization","key_":"cpu.util[3]","value_type":"0","hostid":"10","lastvalue":"0","lastclock":"0","hosts":[{"hostid":"10","name":"web01"}]}
			]}`
		}
		return `{"result":null}`
	})

	query := &QueryModel{
		RefID:     "A",
		QueryType: MODE_MULTIMETRIC_TABLE,
		Group:     QueryFilter{Filter: "Linux servers"},
		Host:      QueryFilter{Filter: "/.*/"},
		TableConfig: &MultiMetricTableConfig{
			RowSource: "host",
			Metrics: []MetricColumnConfig{
				{ColumnName: "CPU", SearchType: "itemName", Pattern: "/CPU #\\d utilization/", Aggregation: "last"},
			},
		},
	}

	frames, err := ds.queryMultiMetricTable(context.Background(), query)
	require.NoError(t, err)
	require.Len(t, frames, 1)
	frame := frames[0]
	require.Equal(t, 1, frame.Rows())
	value, ok := frame.Fields[1].At(0).(*string)
	require.True(t, ok)
	require.NotNil(t, value)
	assert.Equal(t, "10", *value)

	require.NotNil(t, frame.Meta)
	require.Len(t, frame.Meta.Notices, 1)
	assert.Equal(t, data.NoticeSeverityWarning, frame.Meta.Notices[0].Severity)
	assert.Contains(t, frame.Meta.Notices[0].Text, `"CPU" matches more than one item in 1 row(s)`)
}

func TestAggregateHistoryByKey_FirstItemWithHistoryWins(t *testing.T) {
	ds := MockZabbixDataSource("", 200)
	items := []*zabbix.Item{{ID: "1"}, {ID: "2"}, {ID: "3"}}
	history := zabbix.History{
		{ItemID: "2", Value: 10},
		{ItemID: "2", Value: 20},
		{ItemID: "3", Value: 90},
	}
	sameRow := func(*zabbix.Item) string { return "web01" }

	result := ds.aggregateHistoryByKey(history, items, sameRow, "avg")
	assert.Equal(t, map[string]string{"web01": "15.00"}, result, "item 1 has no history; item 2 is the first with values")
}

func TestQueryMultiMetricTable_UnsupportedAggregationFails(t *testing.T) {
	ds := MockZabbixDataSource("", 200)
	ds.zabbix = zabbix.NewZabbixClientWithHandler(t, func(payload zabbix.ApiRequestPayload) string {
		switch payload.Method {
		case "apiinfo.version":
			return `{"result":"7.0.0"}`
		case "hostgroup.get":
			return `{"result":[{"groupid":"1","name":"Linux servers"}]}`
		case "host.get":
			return `{"result":[{"hostid":"10","name":"web01"}]}`
		case "item.get":
			return `{"result":[
				{"itemid":"1","name":"CPU utilization","key_":"system.cpu.util","value_type":"0","hostid":"10","lastvalue":"12.5","lastclock":"1700000000","hosts":[{"hostid":"10","name":"web01"}]},
				{"itemid":"2","name":"OS","key_":"system.sw.os","value_type":"1","hostid":"10","lastvalue":"Linux","lastclock":"1700000000","hosts":[{"hostid":"10","name":"web01"}]}
			]}`
		}
		return `{"result":null}`
	})

	tests := []struct {
		name    string
		metric  MetricColumnConfig
		wantErr string
	}{
		{
			name:    "empty",
			metric:  MetricColumnConfig{ColumnName: "CPU", SearchType: "itemName", Pattern: "CPU utilization"},
			wantErr: `metric column "CPU": unsupported aggregation ""`,
		},
		{
			name:    "misspelt",
			metric:  MetricColumnConfig{ColumnName: "CPU", SearchType: "itemName", Pattern: "CPU utilization", Aggregation: "average"},
			wantErr: `metric column "CPU": unsupported aggregation "average"`,
		},
		{
			name:   "ignored for text columns",
			metric: MetricColumnConfig{ColumnName: "OS", SearchType: "itemName", Pattern: "OS", ValueType: "text"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := &QueryModel{
				RefID:     "A",
				QueryType: MODE_MULTIMETRIC_TABLE,
				Group:     QueryFilter{Filter: "Linux servers"},
				Host:      QueryFilter{Filter: "/.*/"},
				TableConfig: &MultiMetricTableConfig{
					RowSource: "host",
					Metrics:   []MetricColumnConfig{tt.metric},
				},
			}

			frames, err := ds.queryMultiMetricTable(context.Background(), query)
			if tt.wantErr == "" {
				require.NoError(t, err)
				require.Len(t, frames, 1)
				return
			}
			require.Error(t, err)
			assert.Nil(t, frames)
			assert.Contains(t, err.Error(), tt.wantErr)
			assert.True(t, backend.IsDownstreamError(err))
		})
	}
}

// item.get is filtered by host and value type only, so with entity-pattern rows the numeric metric
// columns reuse the entity items instead of sending the same request again.
func TestQueryMultiMetricTable_ItemGetCalls(t *testing.T) {
	tests := []struct {
		name      string
		rowSource string
		metrics   []MetricColumnConfig
		wantCalls int
	}{
		{
			name: "entity rows, numeric columns",
			metrics: []MetricColumnConfig{
				{ColumnName: "In", SearchType: "itemName", Pattern: "/Bits received$/", Aggregation: "last"},
				{ColumnName: "Out", SearchType: "itemName", Pattern: "/Bits sent$/", Aggregation: "last"},
			},
			wantCalls: 1,
		},
		{
			name: "entity rows, numeric and text columns",
			metrics: []MetricColumnConfig{
				{ColumnName: "In", SearchType: "itemName", Pattern: "/Bits received$/", Aggregation: "last"},
				{ColumnName: "Status", SearchType: "itemName", Pattern: "/Operational status$/", ValueType: "text"},
			},
			wantCalls: 2,
		},
		{
			name:      "host rows, numeric column",
			rowSource: "host",
			metrics: []MetricColumnConfig{
				{ColumnName: "In", SearchType: "itemName", Pattern: "Interface eth0: Bits received", Aggregation: "last"},
			},
			wantCalls: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			itemGetCalls := 0
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
					itemGetCalls++
					return `{"result":[
						{"itemid":"1","name":"Interface eth0: Bits received","key_":"net.if.in[eth0]","value_type":"3","hostid":"10","lastvalue":"100","lastclock":"1700000000","hosts":[{"hostid":"10","name":"router-a"}]},
						{"itemid":"2","name":"Interface eth0: Bits sent","key_":"net.if.out[eth0]","value_type":"3","hostid":"10","lastvalue":"200","lastclock":"1700000000","hosts":[{"hostid":"10","name":"router-a"}]}
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
					RowSource: tt.rowSource,
					EntityPattern: EntityPatternConfig{
						SearchType:     "itemName",
						Pattern:        "/^Interface /",
						ExtractPattern: `Interface (.*): .*`,
					},
					Metrics: tt.metrics,
				},
			}

			_, err := ds.queryMultiMetricTable(context.Background(), query)
			require.NoError(t, err)
			assert.Equal(t, tt.wantCalls, itemGetCalls)
		})
	}
}

func TestTagColumnName(t *testing.T) {
	assert.Equal(t, "Interface", TagColumnConfig{Name: "Interface", Tag: "interface"}.ColumnName())
	assert.Equal(t, "interface", TagColumnConfig{Tag: "interface"}.ColumnName(), "falls back to the tag name")
}
