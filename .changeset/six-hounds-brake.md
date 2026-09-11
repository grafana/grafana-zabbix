---
'grafana-zabbix': minor
---

Problems query: support all Zabbix tag-filter operators (Exists, Equals, Contains, Does not exist, Does not equal, Does not contain). The free-text tags field is replaced by a structured tag filter editor matching the Zabbix Problems view — each filter has a tag name, an operator picker, and a value. Extended operators are offered only on Zabbix 5.4+, where `problem.get`/`event.get` accept them; older versions keep Equals and Contains. Existing dashboards are migrated automatically: legacy `tag1:value1` text filters are converted to structured filters with the Equals operator they were previously queried with.
