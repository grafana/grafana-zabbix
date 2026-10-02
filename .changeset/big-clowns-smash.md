---
'grafana-zabbix': minor
---

feat(backend): Make the plugin's gRPC message size limits configurable through the `[plugin.alexanderzobnin-zabbix-datasource]` section of `grafana.ini` (`grpc_max_receive_msg_size_mb`, `grpc_max_send_msg_size_mb`). Defaults stay at 32 MB / 100 MB; values are clamped to 512 MB.
