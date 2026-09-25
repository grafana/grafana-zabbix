// Benchmark: Zabbix API call/payload comparison between the plain "metric" mode
// and the new "multi-metric table" mode for an "Interface bits in/out" table.
//
// The numbers are derived by replicating the exact request graph used in the
// backend (see pkg/datasource/zabbix.go and pkg/zabbix/methods.go), counting
// every JSON-RPC call the plugin would issue against Zabbix to render the same
// table, plus a rough payload estimate.
//
// Run from the repo root:
//
//	go run ./bench/multimetric
//	go run ./bench/multimetric -hosts 50 -ifaces 24 -range 6h -interval 60s -rpc 40ms
package main

import (
	"flag"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"
	"time"
)

// Rough average serialized sizes (bytes) used for the payload estimate.
// These match the field sets the plugin actually requests (see GetAllItems
// and getHistory in pkg/zabbix/methods.go).
const (
	bytesPerItemRecord       = 260 // item.get record (no lastvalue)
	bytesPerItemRecordWithLV = 320 // item.get record (with lastvalue)
	bytesPerHostRecord       = 90
	bytesPerGroupRecord      = 60
	bytesPerHistoryPoint     = 80 // {itemid, clock, ns, value}
	rpcOverheadBytes         = 250
)

type Counter struct {
	HostGroupGet int
	HostGet      int
	ItemGet      int
	HistoryGet   int
	PayloadBytes int64
}

func (c *Counter) Total() int { return c.HostGroupGet + c.HostGet + c.ItemGet + c.HistoryGet }

// hostgroup.get + host.get: resolve a group filter into the matching hostids.
// Mirrors zabbix.GetHosts → GetGroups + GetAllHosts.
func (c *Counter) getHosts(groups, hostsPerGroup int) {
	c.HostGroupGet++
	c.PayloadBytes += rpcOverheadBytes + int64(groups)*bytesPerGroupRecord
	c.HostGet++
	c.PayloadBytes += rpcOverheadBytes + int64(groups*hostsPerGroup)*bytesPerHostRecord
}

// item.get for `totalItemsOnHosts` items. `withLastValue` toggles the lastvalue
// field, which is what the multi-metric mode relies on.
func (c *Counter) itemGet(totalItemsOnHosts int, withLastValue bool) {
	c.ItemGet++
	rec := bytesPerItemRecord
	if withLastValue {
		rec = bytesPerItemRecordWithLV
	}
	c.PayloadBytes += rpcOverheadBytes + int64(totalItemsOnHosts)*int64(rec)
}

// history.get for `matchedItems` items over a time window with `points` samples
// each. GetHistory groups itemids by value_type; for interface bits items the
// type is typically uniform (numeric float), hence a single RPC call.
func (c *Counter) historyGet(matchedItems, points int) {
	c.HistoryGet++
	c.PayloadBytes += rpcOverheadBytes + int64(matchedItems)*int64(points)*bytesPerHistoryPoint
}

type Scenario struct {
	Hosts             int
	InterfacesPerHost int
	// Total items per host that match `monitored=true` and value_type=num.
	// The plain item.get and the multi-metric "/.*/" fallback both return the
	// full numeric-item set for the selected hosts.
	NumericItemsPerHost int
	RangeMinutes        int
	SampleIntervalSec   int
}

func (s Scenario) totalItems() int {
	return s.Hosts * s.NumericItemsPerHost
}

func (s Scenario) pointsPerItem() int {
	return (s.RangeMinutes * 60) / s.SampleIntervalSec
}

// itemsMatchingInterfacePattern counts items that match a single
// "Interface .*: Bits {received,sent}" pattern.
func (s Scenario) itemsMatchingInterfacePattern() int {
	return s.Hosts * s.InterfacesPerHost
}

// --- Plain "metric" mode ---
// To render a table with two metric columns the user creates two queries (one
// per metric) and combines them with Grafana transforms. Each query runs the
// queryNumericItems flow.
func simulatePlainMode(s Scenario, metricCount int) Counter {
	var c Counter
	for i := 0; i < metricCount; i++ {
		// queryNumericItems → GetItems → GetHosts + GetAllItems
		c.getHosts(1, s.Hosts)
		c.itemGet(s.totalItems(), false)

		// Plain mode always fetches full history for every matching item
		// (or trends for long ranges; we count the same RPC).
		matched := s.itemsMatchingInterfacePattern()
		c.historyGet(matched, s.pointsPerItem())
	}
	return c
}

// --- Multi-metric table mode ---
// Single query. Always:
//   - one GetItemsWithLastValue for the entity pattern
//   - one GetItemsWithLastValue covering all metrics (the "/.*/" fallback when
//     more than one metric is configured; same call when there's only one)
//
// Plus one history.get per metric whose aggregation != "last".
func simulateMultiMetricMode(s Scenario, metricCount, nonLastAggregations int) Counter {
	var c Counter

	// 1) Entity pattern lookup with lastvalue=true.
	c.getHosts(1, s.Hosts)
	c.itemGet(s.totalItems(), true)

	// 2) Metric pattern lookup with lastvalue=true. With multiple metrics the
	//    backend falls back to a broad "/.*/" item.get and filters in memory.
	if metricCount >= 1 {
		c.getHosts(1, s.Hosts)
		c.itemGet(s.totalItems(), true)
	}

	// 3) Aggregations other than "last" still require history.
	matched := s.itemsMatchingInterfacePattern()
	for i := 0; i < nonLastAggregations; i++ {
		c.historyGet(matched, s.pointsPerItem())
	}
	return c
}

func fmtBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %ciB", float64(b)/float64(div), "KMGT"[exp])
}

func fmtDuration(d time.Duration) string {
	if d < time.Second {
		return fmt.Sprintf("%d ms", d.Milliseconds())
	}
	return d.Round(10 * time.Millisecond).String()
}

type result struct {
	label string
	c     Counter
}

func printComparison(s Scenario, rpcLatency time.Duration, results ...result) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)

	fmt.Fprintln(w, "Mode\thostgroup.get\thost.get\titem.get\thistory.get\tTotal calls\tEst. payload\tEst. wall-clock @ "+rpcLatency.String())
	fmt.Fprintln(w, strings.Repeat("-", 110))

	for _, r := range results {
		c := r.c
		fmt.Fprintf(
			w,
			"%s\t%d\t%d\t%d\t%d\t%d\t%s\t%s\n",
			r.label, c.HostGroupGet, c.HostGet, c.ItemGet, c.HistoryGet,
			c.Total(), fmtBytes(c.PayloadBytes),
			fmtDuration(time.Duration(c.Total())*rpcLatency),
		)
	}
	w.Flush()
	fmt.Println()

	if len(results) == 2 {
		a, b := results[0].c, results[1].c
		fmt.Printf("Speedup (calls):    %.1fx fewer\n", ratio(a.Total(), b.Total()))
		fmt.Printf("Speedup (payload):  %.1fx less data\n", ratio64(a.PayloadBytes, b.PayloadBytes))
		fmt.Printf("Speedup (latency):  %.1fx faster (assuming serial RPC)\n", ratio(a.Total(), b.Total()))
	}
}

func ratio(a, b int) float64 {
	if b == 0 {
		return 0
	}
	return float64(a) / float64(b)
}

func ratio64(a, b int64) float64 {
	if b == 0 {
		return 0
	}
	return float64(a) / float64(b)
}

func main() {
	hosts := flag.Int("hosts", 10, "number of monitored hosts (matched by Host filter)")
	ifaces := flag.Int("ifaces", 8, "interfaces per host (rows in the resulting table)")
	itemsPerHost := flag.Int("items-per-host", 120, "total monitored numeric items per host (drives item.get payload size)")
	timeRange := flag.Duration("range", time.Hour, "panel time range (e.g. 1h, 6h, 24h)")
	sampleInterval := flag.Duration("interval", time.Minute, "Zabbix item sample interval")
	rpcLatency := flag.Duration("rpc", 50*time.Millisecond, "estimated wall-clock per Zabbix JSON-RPC call")
	metrics := flag.Int("metrics", 2, "metric columns in the table (e.g. 2 = Bits in + Bits out)")
	multiAgg := flag.Int("multi-non-last", 0, "how many of the multi-metric columns use a non-\"last\" aggregation (each adds a history.get)")
	flag.Parse()

	scenario := Scenario{
		Hosts:               *hosts,
		InterfacesPerHost:   *ifaces,
		NumericItemsPerHost: *itemsPerHost,
		RangeMinutes:        int(timeRange.Minutes()),
		SampleIntervalSec:   int(sampleInterval.Seconds()),
	}

	fmt.Printf(
		"Scenario: %d hosts × %d interfaces, %d numeric items/host, range=%s, sample=%s, RPC=%s\n",
		scenario.Hosts, scenario.InterfacesPerHost, scenario.NumericItemsPerHost,
		timeRange, sampleInterval, rpcLatency,
	)
	fmt.Printf(
		"Resulting table: %d rows × %d metric columns. Estimated history points per matched item: %d\n\n",
		scenario.Hosts*scenario.InterfacesPerHost, *metrics, scenario.pointsPerItem(),
	)

	plain := simulatePlainMode(scenario, *metrics)
	multi := simulateMultiMetricMode(scenario, *metrics, *multiAgg)

	printComparison(scenario, *rpcLatency,
		result{"Plain metric (one query per column + Grafana transforms)", plain},
		result{fmt.Sprintf("Multi-metric table (this branch, %d non-last agg)", *multiAgg), multi},
	)
}
