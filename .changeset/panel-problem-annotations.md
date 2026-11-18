---
'grafana-zabbix': minor
---

Add problem annotations to Metrics and Item ID queries. Turn on **Show problems** in a query's new **Problem annotations** section and its panel shows the problems of the triggers that use the items it returns (including inherited and discovered triggers), as regions from start to recovery colored by severity. A trigger filter (exact name, `/regex/` with exclusions, or template variables), a minimum severity and a hide-acknowledged switch narrow the problems per query. A new data source setting, **Show problem annotations on metric panels**, turns them on for every query that doesn't set them; it is off by default, so existing dashboards are unchanged. A panel that uses problem annotations makes at most two extra Zabbix API calls per refresh (one cached), and none when they are off. Series now also carry a `$__zbx_item_id` alias macro.
