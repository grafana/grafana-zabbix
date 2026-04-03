---
'grafana-zabbix': patch
---

"/auth" property it deprecated since 7.0, but the actual implementation consider it only from 7.2 causing deprecation error in webserver logs. This patch fix the error
