---
title: Zabbix alerting
menuTitle: Alerting
description: Set up Grafana alert rules using the Zabbix data source.
aliases:
  - reference/alerting/
keywords:
  - grafana
  - zabbix
  - alerting
  - alert rules
labels:
  products:
    - oss
    - enterprise
    - cloud
weight: 500
last_reviewed: 2026-02-18
---

# Zabbix alerting

You can create Grafana alert rules that evaluate Zabbix metrics and trigger notifications when conditions are met. This lets you combine Zabbix monitoring data with Grafana alerting features such as contact points, notification policies, and silences.

## Before you begin

- [Configure the Zabbix data source](./configure/).
- Understand [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Supported query types

The following query types can be used in alert rules:

- **Metrics** -- query numeric time series data by group, host, and item.
- **Item ID** -- query numeric data by specific Zabbix item IDs.

Other query types (Problems, Triggers, Services, Text, User macros) are not supported and return an error when used in alert rules.

## Functions in alert rules

Data processing functions are evaluated in the backend and work in alert rules. You can use transform functions (`groupBy`, `scale`, `delta`, `rate`, `movingAverage`, etc.), aggregate functions (`aggregateBy`, `sumSeries`, `percentileAgg`), filter functions (`top`, `bottom`, `sortSeries`), and time functions (`timeShift`).

Alias functions (`setAlias`, `setAliasByRegex`, `replaceAlias`) are skipped during alert evaluation because they only affect display names and don't change the underlying data.

## Create an alert rule

To create an alert rule using Zabbix data:

1. Open a dashboard panel that uses the Zabbix data source with a **Metrics** or **Item ID** query.
1. Click the panel title and select **Edit**.
1. Click the **Alert** tab.
1. Click **Create alert rule from this panel**.
1. Configure the alert condition, evaluation interval, and notification settings.
1. Click **Save rule and exit**.

For detailed instructions on configuring alert rules, evaluation groups, contact points, and notification policies, refer to the [Grafana Alerting documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Next steps

- [Build Metrics queries with the Zabbix query editor](./query-editor/#metrics)
- [Configure contact points for notifications](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/)
- [Troubleshoot the Zabbix data source](./troubleshooting/)
