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
review_date: 2026-11-17
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
| **Group** | Filter by host group. Select from the drop-down or type a custom value. A plain value must match the group name exactly; use a regex wrapped in forward slashes (for example, `/^Linux/`) for partial matches. `*` wildcards aren't supported in this field. Supports template variables. Leave empty to include all groups. |
| **Host** | Filter by host. Select from the drop-down or type a custom value. A plain value must match the host name exactly; use a regex (for example, `/^web0[12]$/`) for partial matches. `*` wildcards aren't supported in this field. Supports template variables. Leave empty to include all hosts. |
| **Application** | Filter by application. Applies to Zabbix versions earlier than 5.4 only; later versions ignore this field. Supports regex and template variables. |
| **Problem** | Filter by problem name, matched against the trigger name. A plain value must match the name exactly. To match partially, use a regex wrapped in forward slashes (for example, `/CPU/`) or a `*` wildcard (for example, `High CPU*`). Leave empty to include all problems. |
| **Min severity** | Show only events at or above this severity level: Not classified, Information, Warning, Average, High, or Disaster. |

## Annotation options

These toggle options control which events appear and what information is displayed.

| Option | Description |
|--------|-------------|
| **Show OK events** | Display recovery (OK) events as annotations in addition to problem events. |
| **Hide acknowledged events** | Exclude problems that have been acknowledged in Zabbix. |
| **Show hostname** | Add the hostname of each event as an annotation tag. |

## Annotation content

Each annotation is rendered from the matching Zabbix problem:

- **Title**: `Problem` when the event is active or `OK` when it's a recovery event.
- **Text**: the problem (trigger) name, followed by acknowledgment details when the problem has been acknowledged.
- **Tags**: the host names of the affected hosts when **Show hostname** is enabled.

## Examples

### Monitor high-severity events across production

Annotate a dashboard with only high-severity and disaster-level problems from your production servers.

1. Set **Group** to the host group containing your production servers (for example, `Production`).
1. Set **Host** to `/.*/` to include all hosts in the group.
1. Set **Min severity** to **High**.
1. Enable **Show OK events** to see both when problems start and when they resolve.
1. Enable **Show hostname** to identify which host triggered each event.

### Annotate problems for a single host

Overlay all problems from one host onto its dashboard.

1. Set **Group** to the host's group (or leave it empty).
1. Set **Host** to the exact host name (for example, `web01`).
1. Leave **Problem** and **Min severity** at their defaults to include every problem.

### Follow the dashboard variables

Make the annotations follow the host group and hosts selected in the dashboard's [template variables](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/template-variables/), so that changing a variable also changes which problems appear on the graphs.

1. Create a `group` variable and a `host` variable that use the Zabbix data source, as described in [Template variables](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/template-variables/).
1. Set **Group** to `$group`.
1. Set **Host** to `$host`.

The plugin matches a variable's value as an exact name, so `$host` with `web01` selected shows only the problems of `web01`. When a multi-value variable has several values selected, problems from any of them are shown, and **All** includes every value of the variable.

To ignore one of the filters, leave it empty instead of using a variable. For example, set **Group** to `$group` and leave **Host** empty to show the problems of every host in the selected groups.

### Filter by problem name

Show only problems whose trigger name mentions CPU, regardless of severity.

1. Leave **Group** and **Host** empty to search all hosts.
1. Set **Problem** to `/CPU/` to match any trigger name containing `CPU`.

Because a plain value matches the trigger name exactly, use the regex form (`/CPU/`) or a wildcard (`CPU*`) for partial matches.

### Show only unacknowledged problems

Reduce noise by hiding problems that an operator has already acknowledged in Zabbix.

1. Configure the **Group**, **Host**, and **Min severity** filters for the events you care about.
1. Enable **Hide acknowledged events**.

## Next steps

- [Build queries with the Zabbix query editor](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/query-editor/)
- [Set up alerting rules](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/alerting/)
