---
'grafana-zabbix': patch
---

🐛 Fix the datasource and Problems panel logo icons 404'ing in Grafana's UI since 6.8.0. The managed webpack copy config only copies the logo declared in the root `plugin.json` (the app); the nested datasource/panel-triggers plugins' own logos never reached `dist`.
