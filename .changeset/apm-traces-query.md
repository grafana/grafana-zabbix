---
'grafana-zabbix': minor
---

Add a Traces query type for OpenTelemetry traces collected by Zabbix APM (Zabbix 8.0+): search traces via apmtrace.get by service, span name, status, duration, and OTEL attributes, and open a trace by ID in the trace view via apmspan.get. With a ClickHouse Direct DB Connection, traces are read from the otel_traces table directly
