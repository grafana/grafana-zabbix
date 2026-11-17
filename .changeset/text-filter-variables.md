---
'grafana-zabbix': patch
---

🐛 Fix Text query filter never matching when it contains a dashboard variable. The interpolated filter was wrapped as `/^…$/` and then used as a literal regular expression, so it could not match any value. Closes #2604.
