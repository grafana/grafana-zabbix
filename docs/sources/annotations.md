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
review_date: 2026-09-08
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

{{< figure src="https://raw.githubusercontent.com/grafana/grafana-zabbix/main/docs/images/screenshot-zabbix-annotation-query.png" alt="Zabbix annotation query with Group and Host set to /.*/, Min severity set to Average, and Show OK events and Show hostname enabled" width="960" height="320" max-width="700px" >}}

## Annotation query fields

Use the following fields to filter which Zabbix problems appear as annotations.

| Field | Description |
|-------|-------------|
| **Group** | Filter by host group. Select from the drop-down or type a custom value. Supports regex and template variables. |
| **Host** | Filter by host. Select from the drop-down or type a custom value. Supports regex and template variables. |
| **Application** | Filter by application. Select from the drop-down or type a custom value. Supports regex and template variables. |
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

## Show item problems on a panel

Metrics and Item ID queries can annotate their own panel with the problems of the triggers that use the queried items. Unlike a dashboard annotation query, you don't need to repeat the group and host filters: the panel shows exactly the problems that belong to the items it graphs. Each problem appears as a region from the time it started until it recovered, or until the end of the time range if it's still open.

{{< figure src="https://raw.githubusercontent.com/grafana/grafana-zabbix/main/docs/images/screenshot-zabbix-problem-annotations-panel.png" alt="Two time series panels with problem regions: CPU utilization on db-01 with a resolved and an open High CPU utilization problem, and load average on web-03 with a resolved and an open high load problem, each region matching a spike in the data" width="1600" height="700" >}}

To show item problems on a panel:

1. Edit the panel and open a Metrics or Item ID query.
1. Expand the **Problem annotations** section below **Functions**.
1. Turn on **Show problems**.
1. Optionally, narrow the problems with the following settings.

{{< figure src="https://raw.githubusercontent.com/grafana/grafana-zabbix/main/docs/images/screenshot-zabbix-problem-annotations-query-options.png" alt="Metrics query for CPU utilization on db-01 with the Problem annotations section expanded: Show problems enabled, Triggers set to all triggers of these items with a count of 1 of 1 triggers, Min severity, and Hide acknowledged" width="1254" height="480" >}}

| Setting | Description |
|---------|-------------|
| **Show problems** | Annotate the panel with the problems of the queried items' triggers. |
| **Triggers** | Leave empty to use every trigger of the queried items. Select one trigger name, or enter a regular expression such as `/CPU\|load/` for several triggers or `/^(?!.*memory).*$/i` to exclude some. Template variables are supported. The count next to the field shows how many triggers the filter matches. |
| **Min severity** | Show only problems at or above this severity. |
| **Hide acknowledged** | Exclude problems that have been acknowledged in Zabbix. |

To turn problem annotations on for every Metrics and Item ID query of a data source, enable **Show problem annotations on metric panels** in the data source settings. Each query can still turn it off in its **Problem annotations** section.

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

### Filter by problem name

Show only problems whose trigger name mentions CPU, regardless of severity.

1. Set **Group** to `/.*/` and **Host** to `/.*/` to search all hosts.
1. Set **Problem** to `/CPU/` to match any trigger name containing `CPU`.

Because a plain value matches the trigger name exactly, use the regex form (`/CPU/`) or a wildcard (`CPU*`) for partial matches.

### Show only unacknowledged problems

Reduce noise by hiding problems that an operator has already acknowledged in Zabbix.

1. Configure the **Group**, **Host**, and **Min severity** filters for the events you care about.
1. Enable **Hide acknowledged events**.

## Next steps

- [Build queries with the Zabbix query editor](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/query-editor/)
- [Set up alerting rules](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/alerting/)
