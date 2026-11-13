package datasource

import (
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
