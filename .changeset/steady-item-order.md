---
'grafana-zabbix': patch
---

Fix unstable series order on Zabbix 8.0 when several hosts have an item with the same name. Items that share a name are now ordered by host name and then by item ID, so series, legend entries and table rows keep the same order between refreshes.
