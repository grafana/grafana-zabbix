---
'grafana-zabbix': patch
---

Fix the **Hide acknowledged events** and **Show hostname** annotation options, which had no effect: the annotation query now reads them from where the editor saves them. Acknowledgment details in annotations now show the user login on Zabbix 5.4 and later instead of `undefined`.
