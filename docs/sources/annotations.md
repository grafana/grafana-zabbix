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

Annotations overlay event markers on graph panels, letting you correlate Zabbix problems and recovery events with metric data.

The plugin offers two kinds of annotations:

- **Panel problem annotations**: a Metrics or Item ID query shows the problems of the triggers that use the items it returns, on its own panel only. You turn them on per query, with no dashboard setup, and each problem is drawn as a region from its start to its recovery.
- **Dashboard annotation queries**: a dashboard-level query that selects problems by host group, host, application and problem name, and shows them on every panel (or on the panels you choose).

Use panel problem annotations when you want each graph to show the problems of the items it plots. Use a dashboard annotation query when you want the same set of problems on several panels, or problems that don't come from the panel's items.

## Before you begin

- [Configure the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/).
- Understand [Grafana annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/).

## Annotate a panel with its items' problems

To show the problems of a panel's own items:

1. Edit the panel and open its Zabbix **Metrics** or **Item ID** query.
1. Expand **Problem annotations** below the functions.
1. Turn on **Show problems**.

The panel then shows every problem, inside the dashboard time range, of the triggers that use the items the query returns. This includes triggers inherited from templates and triggers created by low-level discovery: each discovered item gets the problems of its own discovered trigger. Only the items the query actually returns count, so functions such as `top()` narrow the annotations too. A query whose series are built from several items, for example with `sumSeries()`, uses every item its filters match.

| Field | Description |
|-------|-------------|
| **Show problems** | Turn the annotations on or off for this query. When the query doesn't set it, the data source default applies (refer to [Configure other settings](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/#configure-other-settings)). |
| **Triggers** | Which triggers of the query's items to use, matched on the trigger name like the other filters. Leave empty to use every trigger, pick one trigger from the list, or type a regex wrapped in forward slashes. A counter next to the field shows how many of the items' triggers the filter matches. Supports template variables. |
| **Min severity** | Show only problems at or above this severity. The problem's own severity counts, so a problem whose severity an operator changed in Zabbix is filtered by its new severity. |
| **Hide acknowledged** | Exclude problems that have been acknowledged in Zabbix. |

Each problem is drawn as a region from the time it started to its recovery, colored by severity. A problem that is still open, or that recovered after the end of the time range, runs to the end of the range. The annotation shows:

- **Title**: the severity name, followed by `(resolved)` when the problem has recovered. Severity names and colors follow the data source [severity overrides](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/#configure-problem-severity-overrides).
- **Text**: the problem name.
- **Tags**: the host names and the problem's tags.

When several queries of a panel use annotations, each applies its own settings and a problem shared by several queries appears once.

### Trigger filter examples

| Filter | Result |
|--------|--------|
| *(empty)* | Every trigger of the query's items. |
| `High CPU utilization` | Only the trigger with exactly this name. |
| `/CPU\|load/i` | Every trigger whose name contains `CPU` or `load`, ignoring case. |
| `/^(?!.*memory).*$/i` | Every trigger except those whose name contains `memory`. |
| `$trigger` | The triggers selected in the `trigger` dashboard variable. A multi-value variable matches any of its values. |

### Performance

Panel problem annotations add no Zabbix API calls to queries that don't use them. A panel that uses them makes at most two calls per refresh, whatever the number of its queries: one to find the triggers of the items (cached for the data source **Cache TTL**) and one for the problems and recoveries in the time range. The item IDs come from the query's own results, so the items aren't looked up again. At most 2,000 problem and recovery events are read per panel, newest first.

Because trigger lookups are cached, a trigger created in Zabbix, for example by low-level discovery, appears in the annotations once the cache expires.

Panel problem annotations run in the browser, so alert rules never evaluate them.

## Add a dashboard annotation query

To add Zabbix annotations to a dashboard:

1. Open a dashboard and click **Dashboard settings** (gear icon).
1. Click **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Select the Zabbix data source.
1. Configure the annotation query fields described in the following sections.
1. Click **Apply**.

## Dashboard annotation query fields

Use the following fields to filter which Zabbix problems appear as annotations.

| Field | Description |
|-------|-------------|
| **Group** | Filter by host group. Select from the drop-down or type a custom value. Supports regex and template variables. |
| **Host** | Filter by host. Select from the drop-down or type a custom value. Supports regex and template variables. |
| **Application** | Filter by application. Select from the drop-down or type a custom value. Supports regex and template variables. |
| **Problem** | Filter by problem name, matched against the trigger name. A plain value must match the name exactly. To match partially, use a regex wrapped in forward slashes (for example, `/CPU/`) or a `*` wildcard (for example, `High CPU*`). Leave empty to include all problems. |
| **Min severity** | Show only events at or above this severity level: Not classified, Information, Warning, Average, High, or Disaster. |

## Dashboard annotation options

These toggle options control which events appear and what information is displayed.

| Option | Description |
|--------|-------------|
| **Show OK events** | Display recovery (OK) events as annotations in addition to problem events. |
| **Hide acknowledged events** | Exclude problems that have been acknowledged in Zabbix. |
| **Show hostname** | Add the hostname of each event as an annotation tag. |

## Dashboard annotation content

Each annotation is rendered from the matching Zabbix problem:

- **Title**: `Problem` when the event is active or `OK` when it's a recovery event.
- **Text**: the problem (trigger) name, followed by acknowledgment details when the problem has been acknowledged.
- **Tags**: the host names of the affected hosts when **Show hostname** is enabled.

## Examples

### Show a host's CPU problems on its CPU graph

1. Build a **Metrics** query for the host's CPU utilization item.
1. Expand **Problem annotations** and turn on **Show problems**.

The graph shows every problem of the triggers that use the CPU item, for example separate Warning, High and Disaster thresholds, each in its severity color.

### Show only the critical problems of a panel's items

1. In the query's **Problem annotations**, turn on **Show problems**.
1. Set **Min severity** to **High**.
1. Turn on **Hide acknowledged** to leave out problems someone is already handling.

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
