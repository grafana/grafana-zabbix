---
'grafana-zabbix': patch
---

🐛 History data is now always sorted by time before processing, where previously only trend data was sorted. The Zabbix API sorts `history.get` by `clock`, which has second precision, so points sharing a second could be returned out of order; the data plane contract requires an ascending time field. Sorting is skipped for series that are already sorted, so there is no cost in the common case.

🐛 Fix frames being left with unequal field lengths when leading missing points are padded for a query returning more than one series in a single frame (SLI/SLA). Only the first value field was padded, and because the frame's row count is derived from a cached reference to the first field, it was also left stale.
