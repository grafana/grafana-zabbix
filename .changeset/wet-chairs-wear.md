---
'grafana-zabbix': patch
---

Fix `$__range_series` and other range macros not being expanded in query function params (e.g. `percentile($__range_series, 95)`)
