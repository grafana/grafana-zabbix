---
'grafana-zabbix': major
---

Drop support for Zabbix 5.0 and other versions before 6.0. The plugin now supports the three most recent Zabbix LTS releases (8.0, 7.0 and 6.0) plus the latest standard release. The Application filter is removed from the query, annotation and variable editors.

What happens to saved Application filters:

- Queries that select items (Metrics, Text, and Triggers counted by items): the filter is carried over to an `Application: <name>` item tag filter, unless the query already has an item tag filter. This also applies to queries that still held an Application value on Zabbix 5.4 or later, where the plugin was ignoring it, so those queries start filtering by the `Application` tag.
- A filter that would hide items shown today is dropped instead of carried over: a match-all regex such as `/.*/`, and a filter that uses a template variable such as `$app`.
- Problems and annotation queries: the filter is dropped.
- Variables of the Application query type return no values, and the application part of a legacy `{group}{host}{application}{item}` variable query is ignored.
