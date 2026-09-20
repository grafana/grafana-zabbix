---
'grafana-zabbix': minor
---

Problems query: support all Zabbix tag-filter operators (Exists, Equals, Contains, Does not exist, Does not equal, Does not contain) via a structured tag filter editor. Extended operators require Zabbix 5.4+. Existing free-text `tag:value` filters are migrated automatically and keep returning the same results.
