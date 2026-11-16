---
'grafana-zabbix': patch
---

Fix: the **Hide acknowledged events** and **Show hostname** switches of dashboard annotation queries had no effect. Dashboards that already have them turned on will now hide acknowledged problems and tag annotations with host names.
