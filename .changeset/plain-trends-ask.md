---
'grafana-zabbix': patch
---

Fix trend queries failing on Zabbix 8.0 with `unexpected parameter "trend"` when Direct DB Connection is enabled but the trend data is read through the Zabbix API. The frontend `trend.get` request no longer sends the `trend`, `sortfield` and `sortorder` parameters.
