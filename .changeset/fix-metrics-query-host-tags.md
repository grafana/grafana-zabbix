---
'grafana-zabbix': patch
---

Fix host tag filtering during Metrics query execution: queries configured with host tags now constrain returned series to matching hosts in both backend (Go) and direct DB connection execution paths. Closes #2594.
