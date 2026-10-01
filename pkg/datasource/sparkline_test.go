package datasource

import (
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Sparkline series must have a strictly increasing time axis. Zabbix history is sorted by whole-second
// clock only and carries nanosecond precision, so raw points can be off-grid and out of order within a
// second; buildSparklineFrames aligns them so the table sparkline renders a continuous line.
func TestBuildSparklineFramesAlignsTimeAxis(t *testing.T) {
	ds := MockZabbixDataSource("", 200)

	items := []*zabbix.Item{
		{
			ID:        "10001",
			Name:      "Interface eth0: Bits received",
			Key:       "net.if.in[eth0]",
			Delay:     "60s",
			Units:     "bps",
			ValueType: 3,
			Hosts:     []zabbix.ItemHost{{ID: "1", Name: "host-a"}},
		},
	}

	// Two points share clock=120 with descending nanoseconds (the order Zabbix may return ties in),
	// and timestamps are off the 60s grid. Without alignment this yields a non-monotonic time axis.
	history := zabbix.History{
		{ItemID: "10001", Clock: 60, NS: 500000000, Value: 100},
		{ItemID: "10001", Clock: 120, NS: 900000000, Value: 200},
		{ItemID: "10001", Clock: 120, NS: 100000000, Value: 150},
		{ItemID: "10001", Clock: 180, NS: 250000000, Value: 300},
	}

	pattern := EntityPatternConfig{SearchType: "itemName", Pattern: "/Interface.*/"}
	metric := MetricColumnConfig{ColumnName: "bits in", SearchType: "itemName", Pattern: "/.*received/"}

	frames := ds.buildSparklineFrames(metric, items, history, pattern, false)
	require.Len(t, frames, 1, "expected one frame per item")

	frame := frames[0]
	assert.Equal(t, "bits in", frame.RefID, "each metric gets its own RefID so the transform makes a Trend column per metric")
	require.Len(t, frame.Fields, 2)

	timeField := frame.Fields[0]
	require.Equal(t, data.FieldTypeTime, timeField.Type())
	require.GreaterOrEqual(t, timeField.Len(), 2)

	for i := 1; i < timeField.Len(); i++ {
		prev := timeField.At(i - 1).(time.Time)
		curr := timeField.At(i).(time.Time)
		assert.Truef(t, curr.After(prev), "time axis must be strictly increasing, but point %d (%v) is not after %d (%v)", i, curr, i-1, prev)
	}
}

// With host rows, sparkline series must be labeled by Host alone (no Entity/extracted labels),
// so the per-metric Trend tables join onto the host table on the Host column.
func TestBuildSparklineFramesHostRows(t *testing.T) {
	ds := MockZabbixDataSource("", 200)

	items := []*zabbix.Item{
		{
			ID:        "10001",
			Name:      "CPU utilization",
			Key:       "system.cpu.util",
			Delay:     "60s",
			Units:     "%",
			ValueType: 0,
			Hosts:     []zabbix.ItemHost{{ID: "1", Name: "vm-a"}},
		},
	}

	history := zabbix.History{
		{ItemID: "10001", Clock: 60, Value: 10},
		{ItemID: "10001", Clock: 120, Value: 20},
	}

	pattern := EntityPatternConfig{SearchType: "itemName", Pattern: "/.*/"}
	metric := MetricColumnConfig{ColumnName: "CPU utilization", SearchType: "itemName", Pattern: "/CPU utilization/"}

	frames := ds.buildSparklineFrames(metric, items, history, pattern, true)
	require.Len(t, frames, 1)

	labels := frames[0].Fields[1].Labels
	assert.Equal(t, data.Labels{"Host": "vm-a"}, labels, "host rows must carry only the Host label")
}
