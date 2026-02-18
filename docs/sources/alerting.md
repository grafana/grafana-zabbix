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

You can create Grafana alert rules that evaluate Zabbix metrics and trigger notifications when conditions are met. This lets you use Grafana's alerting system -- including contact points, notification policies, and silences -- with data from your Zabbix monitoring infrastructure.

## Before you begin

- [Configure the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/).
- Understand [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Limitations

The Zabbix data source has the following alerting limitations:

- Only the **Metrics** query type is supported for alert rules. Other query types (Problems, Triggers, Services, Text, Item ID, User macros) can't be used as alert conditions.
- Queries with data processing functions are not supported in alert rules.

## Create an alert rule

To create an alert rule using Zabbix metrics:

1. Open a dashboard panel that uses the Zabbix data source with a **Metrics** query.
1. Click the panel title and select **Edit**.
1. Click the **Alert** tab.
1. Click **Create alert rule from this panel**.
1. Configure the alert condition, evaluation interval, and notification settings.
1. Click **Save rule and exit**.

For detailed instructions on configuring alert rules, evaluation groups, contact points, and notification policies, refer to the [Grafana Alerting documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Next steps

- [Build Metrics queries with the Zabbix query editor](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/query-editor/#metrics)
- [Configure contact points for notifications](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/)
- [Troubleshoot the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/troubleshooting/)
