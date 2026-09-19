---
'grafana-zabbix': patch
---

Fix macros such as `{ITEM.VALUE}` showing unexpanded in the Problems panel Description. Since 6.4.1 the plugin asked Zabbix not to expand the trigger comment, but only expanded it itself when "Item value at problem time" was enabled, so the default query showed the raw macro text.
