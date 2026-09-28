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
review_date: 2026-09-08
---

# Zabbix alerting

You can create Grafana alert rules that evaluate Zabbix metrics and trigger notifications when conditions are met. This lets you combine Zabbix monitoring data with Grafana alerting features such as contact points, notification policies, and silences.

## Before you begin

- [Configure the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/).
- Understand [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Supported query types

The following query types can be used in alert rules:

- **Metrics**: query numeric time series data by group, host, and item.
- **Item ID**: query numeric data by specific Zabbix item IDs.

Other query types (Problems, Triggers, Services, Text, User macros) are not supported and return an error when used in alert rules.

## Functions in alert rules

Data processing functions are evaluated in the backend, so they work in alert rules. You can use transform functions (`groupBy`, `scale`, `delta`, `rate`, `movingAverage`, and others), aggregate functions (`aggregateBy`, `sumSeries`, `percentileAgg`), filter functions (`top`, `bottom`, `sortSeries`), and time functions (`timeShift`).

The following functions are skipped during alert evaluation because they only affect display or are resolved by the frontend:

- Alias functions: `setAlias`, `setAliasByRegex`, and `replaceAlias` change display names but not the underlying data.
- `consolidateBy` and `trendValue` are applied by the frontend or the Direct DB Connection path and have no effect on backend alert evaluation.

Two functions are especially useful when writing alert queries:

- Use `groupBy(interval, avg)` to align raw data points to a consistent step before the alert condition reduces them. This smooths noisy collection intervals and makes thresholds predictable.
- Use `aggregateBy` or `sumSeries` to collapse multiple series into a single series when you want one alert instance instead of one per host or item. See [Multi-dimensional alerts](#multi-dimensional-alerts).

## Create an alert rule

To create an alert rule using Zabbix data:

1. Open a dashboard panel that uses the Zabbix data source with a **Metrics** or **Item ID** query.
1. Click the panel title and select **Edit**.
1. Click the **Alert** tab.
1. Click **Create alert rule from this panel**.
1. Configure the alert condition, evaluation interval, and notification settings.
1. Click **Save rule and exit**.

For detailed instructions on configuring alert rules, evaluation groups, contact points, and notification policies, refer to the [Grafana Alerting documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Example alert rules

The following examples show how to combine a Zabbix query with the Grafana expression pipeline. In each case, query **A** returns the Zabbix data, a **Reduce** expression collapses the series to a single value per evaluation, and a **Threshold** expression defines the alert condition.

### Alert on high CPU load for a single host

Alert when the average CPU load on a web server stays above `5`.

1. Add a **Metrics** query (**A**):
   - **Group:** `Linux servers`
   - **Host:** `web01`
   - **Item:** `CPU load`
   - Add the function `groupBy(1m, avg)` to align data points to a 1-minute step.
1. Add a **Reduce** expression (**B**): **Function** `Last`, **Input** `A`.
1. Add a **Threshold** expression (**C**): **Input** `B`, **IS ABOVE** `5`.
1. Set **C** as the alert condition.

### Alert on low free memory across a host group

Create a separate alert for every host in a group whose available memory drops below 500 MB.

1. Add a **Metrics** query (**A**):
   - **Group:** `Linux servers`
   - **Host:** `/.*/`
   - **Item:** `Available memory`
1. Add a **Reduce** expression (**B**): **Function** `Last`, **Input** `A`.
1. Add a **Threshold** expression (**C**): **Input** `B`, **IS BELOW** `524288000`.

Because the **Host** field matches multiple hosts, this rule produces one alert instance per host. For more information, refer to [Multi-dimensional alerts](#multi-dimensional-alerts).

### Alert on a specific item by ID

When you know the exact item you want to monitor, use an **Item ID** query to avoid regex matching.

1. Add an **Item ID** query (**A**):
   - **Item Ids:** `23456`
1. Add a **Reduce** expression (**B**): **Function** `Mean`, **Input** `A`.
1. Add a **Threshold** expression (**C**): **Input** `B`, **IS ABOVE** your threshold value.

### Alert on an aggregated total across hosts

Alert on a single value that combines many series, such as total inbound traffic across a group of routers.

1. Add a **Metrics** query (**A**):
   - **Group:** `Network devices`
   - **Host:** `/.*/`
   - **Item:** `Inbound traffic`
   - Add the function `sumSeries()` to combine all matching series into one.
1. Add a **Reduce** expression (**B**): **Function** `Last`, **Input** `A`.
1. Add a **Threshold** expression (**C**): **Input** `B`, **IS ABOVE** your threshold value.

Because `sumSeries()` collapses the data into a single series, this rule produces one alert instance for the whole group.

## Multi-dimensional alerts

Grafana alerting creates one alert instance per series returned by the query. A **Metrics** query that matches multiple hosts or items with regex therefore generates a separate alert for each matching series, each with its own set of labels. This is useful when you want per-host notifications from a single rule.

If you instead want a single alert for a group of series, use `aggregateBy` or `sumSeries()` in the query to reduce the data to one series before the alert condition evaluates it.

## Next steps

- [Build Metrics queries with the Zabbix query editor](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/query-editor/#metrics)
- [Configure contact points for notifications](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/)
- [Troubleshoot the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/troubleshooting/)
