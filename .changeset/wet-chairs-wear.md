---
'grafana-zabbix': patch
---

Fix query functions failing with `time: invalid duration "$__range_series"` when using range macros as the interval parameter (e.g. `percentile($__range_series, 95)`). The DataSourceWithBackend migration moved variable interpolation to the start of the query flow, but the range scoped vars (`$__range`, `$__range_ms`, `$__range_s`, `$__range_series`) were only added afterwards, so backend queries received the macro unexpanded. Range vars are now in scope before interpolation, and the backend additionally accepts the literal `$__range_series` macro so alerting queries — which never pass through frontend interpolation — also work.
