---
title: Zabbix annotations
menuTitle: Annotations
description: Display Zabbix problems and events as annotations on Grafana panels.
aliases: []
keywords:
  - grafana
  - zabbix
  - annotations
  - events
  - problems
labels:
  products:
    - oss
    - enterprise
    - cloud
weight: 450
last_reviewed: 2026-02-18
---

# Zabbix annotations

Annotations overlay event markers on graph panels, letting you correlate Zabbix problems and recovery events with metric data. When a Zabbix trigger fires or recovers, the annotation appears as a vertical line on the graph at the time the event occurred.

## Before you begin

- [Configure the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/).
- Understand [Grafana annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/).

## Add an annotation query

To add Zabbix annotations to a dashboard:

1. Open a dashboard and click **Dashboard settings** (gear icon).
1. Click **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Select the Zabbix data source.
1. Configure the annotation query fields described in the following sections.
1. Click **Apply**.

## Annotation query fields

Use the following fields to filter which Zabbix problems appear as annotations.

| Field | Description |
|-------|-------------|
| **Group** | Filter by host group. Select from the drop-down or type a custom value. Supports regex and template variables. |
| **Host** | Filter by host. Select from the drop-down or type a custom value. Supports regex and template variables. |
| **Application** | Filter by application. Select from the drop-down or type a custom value. Supports regex and template variables. |
| **Problem** | Filter by problem name. Type a text string to match against trigger descriptions. |
| **Min severity** | Show only events at or above this severity level: Not classified, Information, Warning, Average, High, or Disaster. |

## Annotation options

These toggle options control which events appear and what information is displayed.

| Option | Description |
|--------|-------------|
| **Show OK events** | Display recovery (OK) events as annotations in addition to problem events. |
| **Hide acknowledged events** | Exclude problems that have been acknowledged in Zabbix. |
| **Show hostname** | Include the hostname in the annotation text. |

## Example: monitor high-severity events

To annotate a dashboard with only high-severity and disaster-level problems from your production servers:

1. Set **Group** to the host group containing your production servers (for example, `Production`).
1. Set **Host** to `/.*/` to include all hosts in the group.
1. Set **Min severity** to **High**.
1. Enable **Show OK events** to see both when problems start and when they resolve.
1. Enable **Show hostname** to identify which host triggered each event.

## Next steps

- [Build queries with the Zabbix query editor](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/query-editor/)
- [Set up alerting rules](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/alerting/)
