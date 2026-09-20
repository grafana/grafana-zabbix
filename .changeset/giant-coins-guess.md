---
'grafana-zabbix': minor
---

Problems panel: add an optional Host IP field (off by default), resolved from the host's IP-based interfaces (multiple IPs comma-separated, DNS-only hosts show an empty string). The interface lookup is gated behind a new "Host IP" query option so it adds no API overhead unless enabled.
