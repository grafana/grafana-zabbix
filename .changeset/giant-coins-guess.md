---
'grafana-zabbix': minor
---

Problems panel: add an optional Host IP field (off by default), shown after Host name and Host technical name in both the table and list layouts. The IP is resolved from the host's interfaces: multiple IP-based interfaces are shown comma-separated, hosts with no interfaces show an empty string, and interfaces connecting via DNS (`useip = 0`) are ignored, so DNS-only hosts show an empty string. To keep the API overhead minimal, the interface lookup is gated behind a new "Host IP" query option (same pattern as "Host proxy"), performed as a single `host.get` + `selectInterfaces` call for only the hosts present in the current result set, and cached via the caching proxy.
