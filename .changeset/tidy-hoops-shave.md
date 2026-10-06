---
'grafana-zabbix': minor
---

🚀 Host tag filter in template variables: add a "Host tag" picker to the Host, Application, Item tag, Item and Item values variable query types so dashboards can filter hosts by tag (e.g. `class:database`, `platform:globalspec`) without per-host-group workarounds. Closes #1682.

🚀 Host tag filtering now matches tags inherited from linked templates, not just directly-assigned host tags — applies to both the panel editor and the variable editor. Hosts are fetched with `selectInheritedTags` and the filter is evaluated client-side against the merged tag list, mirroring the Zabbix And/Or and Or `evaltype` semantics.

🚀 Tag-name and tag-value autocomplete in the host tag picker now suggests options observed across the host inventory (direct + inherited).

🐛 Saved host-tag filters now repopulate the editor on reload, in both the panel editor and the variable editor.
