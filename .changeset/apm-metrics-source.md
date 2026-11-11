---
'grafana-zabbix': minor
---

Add an APM metrics source to the Metrics query for OpenTelemetry metrics collected by Zabbix APM (Zabbix 8.0+): graph gauges, sums, histograms, and exponential histograms read via apmmetric.get, with one series per attribute set, attributes as labels, attribute filters, group by, rate and increase for sums, and quantiles or heatmap buckets for histograms. Queries run in the plugin backend, so they work in alert rules
