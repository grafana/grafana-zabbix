---
'grafana-zabbix': patch
---

Fix `{ITEM.VALUE}` resolving to the wrong value when a "Multiple PROBLEM events" trigger opens several problems within the same second.
