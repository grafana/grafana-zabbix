---
'grafana-zabbix': patch
---

Problems panel: the trigger "External link" now resolves macros exactly like the Zabbix frontend (7.0+): `{TRIGGER.ID}`, `{EVENT.ID}`, `{HOST.*}`, `{ITEM.VALUE}`, `{ITEM.LOG.*}`, the 7.4 value date/time macros, user macros (templates, context, secrets) and macro functions.
