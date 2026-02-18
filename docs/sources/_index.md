---
title: Zabbix data source
menuTitle: Zabbix
description: Use the Zabbix data source to visualize monitoring data from Zabbix in Grafana dashboards.
aliases:
  - features/
  - installation/
  - installation/upgrade/
  - installation/building-from-sources/
keywords:
  - grafana
  - zabbix
  - data source
  - monitoring
  - plugin
labels:
  products:
    - oss
    - enterprise
    - cloud
weight: 100
last_reviewed: 2026-02-18
---

# Zabbix data source

The Zabbix data source connects Grafana to your Zabbix monitoring infrastructure. You can query metrics, display problems and triggers, create annotations from Zabbix events, and build interactive dashboards with template variables. The plugin also supports querying historical data directly from the Zabbix database for improved performance on large time ranges.

## Supported features

| Feature | Supported |
|---------|-----------|
| Metrics | Yes |
| Alerting | Yes |
| Annotations | Yes |
| Template variables | Yes |
| Direct DB Connection | Yes |

## Get started

The following pages help you set up and use the Zabbix data source:

- [Configure the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/)
- [Zabbix query editor](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/query-editor/)
- [Functions reference](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/functions/)
- [Template variables](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/template-variables/)
- [Annotations](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/annotations/)
- [Alerting](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/alerting/)
- [Troubleshooting](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/troubleshooting/)

## Feature highlights

After configuring the data source, you can:

- **Query multiple metrics** using regex to select items across hosts and groups.
- **Apply processing functions** such as `groupBy`, `scale`, `delta`, `rate`, `movingAverage`, and `percentile` to transform and aggregate data.
- **Create template variables** to build dynamic, reusable dashboards that switch between host groups, hosts, and items.
- **Display Zabbix problems** using the Problems panel to monitor active triggers.
- **Annotate graphs** with Zabbix events filtered by severity and acknowledgment status.
- **Use Direct DB Connection** to query history data from MySQL, PostgreSQL, or InfluxDB for faster performance on wide time ranges.
- **Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/)** to query Zabbix data without building a dashboard.
- **Set up [alerting rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/)** based on Zabbix metrics.

## Pre-built dashboards

The plugin includes three pre-built dashboards that you can import from the data source configuration page:

- **Zabbix System Status:** Overview of active problems and system health.
- **Zabbix Template Linux Server:** Linux server monitoring with CPU, memory, disk, and network metrics.
- **Zabbix Server Dashboard:** Zabbix server performance and internal metrics.

To import a dashboard, navigate to **Connections** > **Data sources**, select your Zabbix data source, and click the **Dashboards** tab.

## Plugin updates

Always ensure that your plugin version is up-to-date so you have access to all current features and improvements. Navigate to **Administration** > **Plugins and data** > **Plugins** to check for updates.

{{< admonition type="note" >}}
Plugins are automatically updated in Grafana Cloud.
{{< /admonition >}}

## Related resources

- [Zabbix data source plugin on GitHub](https://github.com/grafana/grafana-zabbix)
- [Zabbix documentation](https://www.zabbix.com/documentation/)
- [Grafana community forum](https://community.grafana.com/)
