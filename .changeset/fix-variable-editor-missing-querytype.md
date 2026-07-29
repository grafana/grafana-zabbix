---
'grafana-zabbix': patch
---

Fix a crash in the variable query editor when a query variable has no saved Zabbix query. From Grafana 13.1, the scenes-based variable editor constructs the editor with a truthy-but-empty query object; the selected query type then resolved to `undefined`, overwrote the valid default, and the next render threw `TypeError: Cannot read properties of undefined (reading 'value')`. Selecting Zabbix as the datasource for a new query variable, switching an existing variable to Zabbix from another datasource, and opening a variable saved with a query type the editor has no option for now all fall back to the default query type instead of crashing.
