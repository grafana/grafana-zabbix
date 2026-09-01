---
'grafana-zabbix': minor
---

Add ClickHouse support for Direct DB Connection. Zabbix 8.0 can store item value history in ClickHouse, and the plugin can now query it directly: select a `grafana-clickhouse-datasource` data source in the Direct DB Connection settings (make sure its default database points to the Zabbix history database, `zabbix` by default). Since Zabbix stores only history data in ClickHouse (trends are not calculated or stored there), all queries - including wide time ranges that would normally switch to trends - are served from the history tables with server-side aggregation.
