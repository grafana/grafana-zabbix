---
'grafana-zabbix': minor
---

Problems query: push the problem-name filter to the Zabbix API (`problem.get`/`event.get` `search`) instead of fetching every problem and filtering client-side. This drastically reduces the data transferred for large environments (avoiding gRPC message-size limits) and makes the `limit` apply to name-matched problems. Plain names and `*` wildcards are filtered fully at the source; regex filters are narrowed at the source by their guaranteed literal substring — including top-level alternations like `/(A|B|C)/`, which are pushed as an OR of branch literals (`searchByAny`) — and are still matched precisely client-side. Look-around regexes (e.g. negative look-ahead `/^(?!...)/` used for exclusion) are evaluated client-side only, so they keep working without being incorrectly narrowed at the source. Problem-name filters now also support `*` wildcards.
