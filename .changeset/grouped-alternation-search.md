---
'grafana-zabbix': patch
---

Fix: Problem name and item variable regex filters with an alternation inside a group (e.g. `/^CPU (user|system)$/`) no longer miss matches when narrowed on the Zabbix side
