---
'grafana-zabbix': patch
---

Fix queries that read trends failing on Zabbix 8.0 with `Invalid parameter "/": unexpected parameter "sortfield"`. The plugin no longer sends `sortfield` and `sortorder` to `trend.get`; trend points are still sorted by time in the plugin.
