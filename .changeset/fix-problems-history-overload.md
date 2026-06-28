---
'grafana-zabbix': patch
---

ProblemsPanel: Fix severe Zabbix DB / PHP-FPM overload caused by the per-problem historical item value lookup (#2427). The `history.get` enrichment introduced in 6.3.1 now runs only when explicitly enabled via the new "Item value at problem time" query option (off by default, restoring 6.3.0 behaviour). When enabled, the history window span and result size are bounded to protect the Zabbix frontend and database in large environments.
