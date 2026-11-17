---
'grafana-zabbix': minor
---

Add an Inventory query type that returns host inventory fields as a table, one row per host. `location_lat` and `location_lon` are returned as numeric `latitude` and `longitude` columns, so the Geomap panel can place hosts from their Zabbix inventory without SQL workarounds (#280).
