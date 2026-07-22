---
'grafana-zabbix': minor
---

Add data links to the Problems panel table layout. A new "Data links" panel option lets you define links rendered as a column on each problem row. Link titles and URLs support problem variables — `${host}`, `${name}`, `${description}`, `${severity}`, `${triggerid}`, `${eventid}` — as well as problem tag values via `${tag_<tag_name>}`, where special characters in the tag name are replaced with underscores (e.g. `${tag_interface_status}` for the `interface-status` tag). Tag variables resolve to an empty string when the problem has no such tag, and when multiple tags share a name the alphabetically first value is used.
