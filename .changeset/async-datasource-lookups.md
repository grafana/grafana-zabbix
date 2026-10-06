---
'grafana-zabbix': patch
---

Look up data sources with the async APIs from `@grafana/plugin-compat` instead of the deprecated `getDataSourceSrv()`, so the plugin keeps working once Grafana loads data sources lazily. Older Grafana versions fall back to the previous APIs.
