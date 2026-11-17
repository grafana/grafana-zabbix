---
'grafana-zabbix': patch
---

🐛 Fix "Use Zabbix value mapping" having no effect in Text queries. Mappings are now applied to the last value in table format, and attached to the value field in time series format. Only exact-match mapping entries are applied, as for numeric queries. Closes #2473.
