---
'grafana-zabbix': major
---

Drop support for Zabbix 5.0 and other versions before 6.0. The plugin now supports the three most recent Zabbix LTS releases (8.0, 7.0 and 6.0) plus the latest standard release. The Application filter is removed from the query, annotation and variable editors; saved queries that used it are migrated to an `Application: <name>` item tag filter, and variables of the Application query type return no values.
