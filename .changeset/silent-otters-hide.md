---
'grafana-zabbix': patch
---

Add a backend allowlist for the resource-proxy CallResource paths so only the exact `zabbix-api` and `db-connection-post` POST routes are served; any other path or method is now rejected with a 403 instead of falling through to the catch-all root handler.
