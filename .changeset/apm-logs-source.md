---
'grafana-zabbix': minor
---

Logs query type: add an APM logs source that queries OpenTelemetry log records (Zabbix 8.0+), with service, severity, body, trace ID, and OTEL attribute filters. Records are retrieved via apmlog.get, or read directly from the otel_logs table when Direct DB Connection is configured with a ClickHouse data source
