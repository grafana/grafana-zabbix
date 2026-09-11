---
title: Zabbix query editor
menuTitle: Query editor
description: Learn how to use the Zabbix query editor to build queries for metrics, problems, triggers, services, and more.
aliases:
  - guides/
  - reference/
  - reference/direct-db-connection/
keywords:
  - grafana
  - zabbix
  - query editor
  - metrics
  - problems
  - triggers
labels:
  products:
    - oss
    - enterprise
    - cloud
weight: 300
review_date: 2026-09-08
---

# Zabbix query editor

The Zabbix query editor lets you build queries to visualize monitoring data from Zabbix. You can query numeric metrics, text data, problems, triggers, IT services, and user macros. Each query type has its own set of fields and options.

## Before you begin

- [Configure the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/).
- Verify your Zabbix user has permissions to access the host groups and hosts you want to query.

## Key concepts

If you're new to Zabbix, the following terms are used throughout this documentation:

| Term | Description |
|------|-------------|
| **Host group** | A logical grouping of hosts in Zabbix, such as "Linux servers" or "Network devices". |
| **Host** | A networked device that Zabbix monitors, identified by name or IP address. |
| **Application** | A grouping of items on a host (Zabbix versions before 5.4). Replaced by item tags in Zabbix 5.4+. |
| **Item** | A specific metric collected from a host, such as CPU load or free memory. |
| **Item tag** | A key-value label attached to an item (Zabbix 5.4+). Replaces applications for organizing items. |
| **Trigger** | A logical expression that evaluates item data and defines a problem threshold. |
| **Problem** | An event generated when a trigger enters a problem state. |
| **IT service** | A business-level service monitored through Zabbix SLA tracking. |

## Query types

Select a query type from the drop-down at the top of the query editor. The available fields change based on the selected type.

### Metrics

Use Metrics queries to retrieve numeric time series data from Zabbix items. This is the most common query type for building graphs and dashboards.

| Field | Description |
|-------|-------------|
| **Group** | The host group to query. Supports regex and template variables. |
| **Host tag** | Filter hosts by tag (Zabbix 5.4+). Click the **+** button to add one or more tag filters. Each filter has a tag name, an operator, and an optional value. Available operators: Exists, Equals, Contains, Does not exist, Does not equal, Does not contain. When multiple filters are active, choose **AND/OR** or **OR** evaluation. |
| **Host** | The host to query. Supports regex and template variables. |
| **Application** | Filter items by application. Visible on Zabbix versions before 5.4. Replaced by **Item tag** on Zabbix 5.4+. |
| **Item tag** | Filter items by tag. Visible on Zabbix 5.4+. Replaces **Application**. Supports template variables. |
| **Item** | The item to query. Supports regex and template variables. |

Expand the **Options** section to access additional settings:

| Option | Description |
|--------|-------------|
| **Trends** | Override the data source trends setting for this query. Values: Default, True, False. |
| **Show disabled items** | Include disabled items in the item drop-down. |
| **Use Zabbix value mapping** | Apply Zabbix value mappings to the returned data. |
| **Disable data alignment** | Disable automatic alignment of data points to collection intervals. |

### Text

Use Text queries to retrieve text and log data from Zabbix items with text value types (character, log, text).

| Field | Description |
|-------|-------------|
| **Group** | The host group to query. Supports regex and template variables. |
| **Host** | The host to query. Supports regex and template variables. |
| **Application** | Filter items by application. This field is always visible regardless of Zabbix version. On Zabbix 5.4+, where applications have been removed, leave this field empty. |
| **Item** | The text item to query. Supports regex and template variables. |
| **Text filter** | Filter returned text values by a search string. |
| **Use capture groups** | Extract parts of the text value using regex capture groups in the text filter. |

Expand the **Options** section to access additional settings:

| Option | Description |
|--------|-------------|
| **Show disabled items** | Include disabled items in the item drop-down. |

### Services

Use Services queries to retrieve IT service SLA data from Zabbix.

| Field | Description |
|-------|-------------|
| **Service** | The IT service to query. Supports template variables. |
| **SLA** | The SLA definition to query. Supports template variables. |
| **Property** | The SLA property to return: Status, SLI, Uptime, Downtime, or Error budget. |
| **Interval** | The reporting interval: No interval, Auto, 1 hour, 12 hours, 24 hours, 1 week, or 1 month. |

This query type shares the same **Options** as Metrics (Trends, Show disabled items, Use Zabbix value mapping, Disable data alignment).

### Item ID

Use Item ID queries to retrieve data for specific Zabbix items by their numeric IDs. This is useful when you know the exact item IDs.

| Field | Description |
|-------|-------------|
| **Item Ids** | A comma-separated list of Zabbix item IDs. |

This query type shares the same **Options** as Metrics (Trends, Show disabled items, Use Zabbix value mapping, Disable data alignment).

### Triggers

Use Triggers queries to count triggers matching specific criteria. This query type returns numeric data suitable for time series panels.

| Field | Description |
|-------|-------------|
| **Count by** | What to count: All triggers, Problems, or Items. |
| **Group** | The host group to filter. Supports regex and template variables. |
| **Host** | The host to filter. Supports regex and template variables. |
| **Proxy** | Filter by Zabbix proxy (visible when **Count by** is set to Problems). |
| **Application** | Filter by application (Zabbix versions before 5.4). |
| **Item tag** | Filter by item tag (Zabbix 5.4+, visible when **Count by** is set to Items). |
| **Problem** | Filter by problem name (visible when **Count by** is set to Problems). |
| **Item** | Filter by item name (visible when **Count by** is set to Items). |
| **Tags** | Filter by tags in `tag1:value1, tag2:value2` format (Zabbix 5.4+). |
| **Min severity** | Minimum trigger severity: Not classified, Information, Warning, Average, High, or Disaster. |
| **Count** | Toggle to return the count as a numeric value. |

Expand the **Options** section to access additional settings:

| Option | Description |
|--------|-------------|
| **Acknowledged** | Filter by acknowledgment status: all triggers, unacknowledged, or acknowledged. |
| **Use time range** | Restrict results to the dashboard time range. |

### Problems

Use Problems queries to retrieve Zabbix problem events. This query type returns tabular data suitable for table panels and the Problems panel.

| Field | Description |
|-------|-------------|
| **Group** | The host group to filter. Supports regex and template variables. |
| **Host** | The host to filter. Supports regex and template variables. |
| **Proxy** | Filter by Zabbix proxy. |
| **Application** | Filter by application (Zabbix versions before 5.4). |
| **Problem** | Filter by problem name, matched against the trigger name. A plain value must match exactly. Use a `*` wildcard (for example, `High CPU*`) or a regex wrapped in forward slashes (for example, `/CPU/`) for partial matches. |
| **Tags** | Filter by tags in `tag1:value1, tag2:value2` format. |
| **Tag evaluation** | How to combine multiple tag filters: AND/OR or OR. |
| **Show** | Which problems to display: Problems (current), Recent problems, or History. |
| **Severity** | Filter by one or more severity levels (multi-select). |
| **Problem Type** | Filter cause and symptom problems: All Problems, Cause only, or Symptoms only. Visible on Zabbix 6.4+, which supports cause and symptom event correlation. |

Expand the **Options** section to access additional settings:

| Option | Description |
|--------|-------------|
| **Acknowledged** | Filter by acknowledgment status: all triggers, unacknowledged, or acknowledged. |
| **Sort by** | Sort order: Default, Last change, or Severity. |
| **Use time range** | Restrict results to the dashboard time range. |
| **Hosts in maintenance** | Include hosts that are currently in maintenance. |
| **Host proxy** | Include proxy information in the results. |
| **Item value at problem time** | Resolve each problem's item value at its creation time (used by `{ITEM.VALUE}` and operational data) via a `history.get` lookup. Disabled by default because it adds load and can impact performance in large environments with many active problems. Leave off unless you need historical-value accuracy. |
| **Limit** | Maximum number of problems to return. Default: `1001`. |

### User macros

Use User macros queries to retrieve Zabbix user macro values.

| Field | Description |
|-------|-------------|
| **Group** | The host group to query. Supports regex and template variables. |
| **Host** | The host to query. Supports regex and template variables. |
| **Macros** | The macro to query. Supports regex and template variables. |

## Use regex in queries

You can use JavaScript regular expressions in the **Group**, **Host**, **Application**, **Item tag**, and **Item** fields to match multiple values. Wrap regex patterns in forward slashes (`/pattern/`).

### Select multiple items

To display multiple CPU metrics on one graph, excluding idle time, use a regex in the **Item** field:

```
/CPU (?!idle).* time/
```

This matches items like "CPU user time", "CPU system time", and "CPU iowait time", but excludes "CPU idle time".

### Compare metrics across hosts

To compare the same metric across multiple hosts, use regex in the **Host** field. For example, to show CPU system time for all hosts with names starting with "backend":

- **Group:** `/.*/`
- **Host:** `/^backend/`
- **Item:** `CPU system time`

### Match all values

Use `/.*/` to match all values in a field. For example, setting **Group** to `/.*/` queries across all host groups.

## Apply functions

You can add processing functions to transform and aggregate query results when using **Metrics**, **Item ID**, or **Services** query types. Click the **+** button next to the query to add functions such as `groupBy`, `scale`, `delta`, `rate`, and `movingAverage`.

For a complete list of available functions, refer to the [functions reference](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/functions/).

## Examples

The following examples show common queries and the panel type that best fits each one.

### Graph a single metric for one host

Plot CPU user time for a web server on a time series panel.

- **Query type:** Metrics
- **Group:** `Linux servers`
- **Host:** `web01`
- **Item:** `CPU user time`

### Compare a metric across a host group

Show available memory for every host in a group on one time series panel. Each host appears as a separate series.

- **Query type:** Metrics
- **Group:** `Linux servers`
- **Host:** `/.*/`
- **Item:** `Available memory`

### Show the top five hosts by a metric

Reduce a noisy graph to only the five busiest hosts. Add a function to the query to rank the series.

- **Query type:** Metrics
- **Group:** `Linux servers`
- **Host:** `/.*/`
- **Item:** `CPU utilization`
- **Function:** `top(5, avg)`

### Aggregate multiple series into one

Combine per-core CPU utilization into a single average line by grouping the matched series.

- **Query type:** Metrics
- **Host:** `web01`
- **Item:** `/CPU .* time/`
- **Function:** `aggregateBy(1m, avg)`

### List current problems in a table

Display active high-severity problems on a table panel.

- **Query type:** Problems
- **Group:** `/.*/`
- **Host:** `/.*/`
- **Show:** Problems
- **Severity:** High, Disaster

### Count active problems for a stat panel

Show the number of current problems in a host group on a stat panel.

- **Query type:** Triggers
- **Count by:** Problems
- **Group:** `Production`
- **Min severity:** High
- Enable **Count** in the query fields.

### Report an SLA value

Show the service level indicator for an IT service on a stat or gauge panel.

- **Query type:** Services
- **Service:** the IT service to report on
- **SLA:** the SLA definition to evaluate
- **Property:** SLI
- **Interval:** Auto

## Direct DB Connection behavior

When [Direct DB Connection](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/#configure-direct-db-connection) is enabled, the plugin retrieves history and trend data directly from the Zabbix database instead of the Zabbix API. This is transparent to the query editor, so you build queries the same way. The key difference is that the database performs server-side aggregation, which reduces data transfer and improves performance on wide time ranges.

The `consolidateBy` function directly controls the aggregation function used in database queries. When using Direct DB Connection, pair it with `groupBy` for accurate results. For example, to group values by 1-hour intervals using the maximum value:

```
consolidateBy(max) | groupBy(1h, max)
```

Without `consolidateBy`, the database aggregates using the default `AVG` function, which may produce unexpected results when combined with `groupBy(interval, max)`.

## Next steps

- [Apply functions to transform query results](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/functions/)
- [Use template variables for dynamic dashboards](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/template-variables/)
- [Set up alerting rules](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/alerting/)
