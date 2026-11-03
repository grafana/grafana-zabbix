---
'grafana-zabbix': minor
---

🚀 Host tag filter in template variables: add a "Host tag" picker to the Host, Application, Item tag, Item and Item values variable query types so dashboards can filter hosts by tag (e.g. `class:database`, `platform:globalspec`) without per-host-group workarounds. Closes #1682.

🚀 Host tag filtering now matches tags inherited from linked templates, not just directly-assigned host tags — applies to both the panel editor and the variable editor. The filter is sent to `host.get` with `inheritedTags: true` (Zabbix 5.0+), so matching stays on the server. A multi-value variable in a tag value expands to one filter per selected value.

🚀 Tag-name and tag-value autocomplete in the host tag picker now suggests options observed across the host inventory (direct + inherited).

🐛 Saved host-tag filters now repopulate the editor on reload, in both the panel editor and the variable editor.

🐛 Template variables in host tag names and values are now interpolated in the panel editor's host tag filter.
