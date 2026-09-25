---
'grafana-zabbix': minor
---

feat(problems): Add global problem severity name and color overrides to the data source settings. They apply to every Problems panel that queries the data source; panels with their own custom severity name or color keep it, and the panel's Colors options flag the rows where a global override is in effect.
