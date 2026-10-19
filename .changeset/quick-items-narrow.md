---
'grafana-zabbix': patch
---

Fix: Item and Item values template variables no longer fetch every item of the host (with tags) from Zabbix; the item name filter is pushed down to the Zabbix API
