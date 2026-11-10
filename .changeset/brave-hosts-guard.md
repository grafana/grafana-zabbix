---
'grafana-zabbix': patch
---

Enforce Grafana role checks in the backend for mutating Zabbix API calls made through the resource proxy: `script.execute` now requires the Admin role, and `event.acknowledge` requires Editor or Admin when "Disable acknowledges for read-only users" is enabled. Previously these calls were forwarded with the data source's stored credentials regardless of the caller's role.
