# Zabbix 8.0 APM / OpenTelemetry devenv

Self-contained stack for developing and testing the Logs query type's **APM logs**
source (`apmlog.get`, Zabbix 8.0+):

```
OTLP/gRPC -> zabbix-proxy (APM collector, :4317) -> ClickHouse <- Zabbix frontend/API (apmlog.get) <- Grafana
```

## Usage

Build the plugin first (`npm run build` and `mage`), then from this directory:

```bash
docker compose up -d
```

- Grafana: http://localhost:3000 (plugin mounted from `../../dist`)
- Zabbix web: http://localhost:8188 (Admin / zabbix)
- ClickHouse: internal only (`clickhouse:8123`, user/password/db `zabbix`)

`apm-bootstrap` registers the active proxy `apm-proxy-1` with APM collection
enabled and points the global APM data source (Administration > Data source)
at ClickHouse. `otel-logs-seed` pushes 200 ERROR log records for the `checkout`
service (it retries until the proxy's collector is up — the collector only
starts listening after the proxy has synced its config, 10-20 s after start).

Seed more data, e.g. a second service:

```bash
docker compose run --rm otel-logs-seed logs --otlp-endpoint zabbix-proxy:4317 --otlp-insecure \
  --logs 50 --rate 0 --otlp-attributes 'service.name="payments"' \
  --severity-text INFO --severity-number 9 --body "payment settled successfully"
```

## Notes

- Zabbix 8.0 telemetry requires ClickHouse >= 26.8.17.4 (older versions reject the
  proxy's fractional-epoch timestamps; the inserts are async and fail silently).
- The proxy's `apm.max_messages_per_second` must be > 0 — the API default `0`
  drops every message (the bootstrap sets 10000).
- The OTEL schema in `clickhouse/01-otel-schema.sql` is rendered from the scripts
  bundled with Zabbix (`/usr/share/doc/zabbix-proxy-sqlite3/clickhouse/` in the
  proxy image). Re-render it from a newer image if Zabbix changes the schema.
- telemetrygen is pinned to v0.120.0, the version the Zabbix docs use.
- Hosts/groups/items created after Grafana has started (e.g. demo log items) are
  invisible to Logs/Text queries until the caches expire: restart the grafana
  container (clears the backend response cache) and hard-reload the browser page
  (clears the frontend metric lookup cache, TTL 1 h).
