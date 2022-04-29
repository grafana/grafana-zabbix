// This package contains internal plugin metrics exposed
// by Grafana at /api/plugins/alexanderzobnin-zabbix-datasource/metrics
// in Prometheus format

package metrics

import "github.com/prometheus/client_golang/prometheus"

var (
	// DataSourceQueryTotal is metric counter for getting total number of data source queries
	DataSourceQueryTotal *prometheus.CounterVec

	// ZabbixAPIQueryTotal is metric counter for getting total number of zabbix API queries
	ZabbixAPIQueryTotal *prometheus.CounterVec

	// CacheHitTotal is metric counter for getting total number of cache hits for requests
	CacheHitTotal *prometheus.CounterVec
)

func init() {
	DataSourceQueryTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "datasource_query_total",
			Help:      "Total number of data source queries.",
			Namespace: "zabbix_datasource",
		},
		[]string{"query_type"},
	)

	ZabbixAPIQueryTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "zabbix_api_query_total",
			Help:      "Total number of Zabbix API queries.",
			Namespace: "zabbix_datasource",
		},
		[]string{"method"},
	)

	CacheHitTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "cache_hit_total",
			Help:      "Total number of cache hits.",
			Namespace: "zabbix_datasource",
		},
		[]string{"method"},
	)

	prometheus.MustRegister(
		DataSourceQueryTotal,
		ZabbixAPIQueryTotal,
		CacheHitTotal,
	)
}
