---
title: Zabbix template variables
menuTitle: Template variables
description: Use template variables with the Zabbix data source to create dynamic, reusable dashboards.
aliases:
  - guides/templating/
keywords:
  - grafana
  - zabbix
  - template variables
  - templating
  - dashboard variables
labels:
  products:
    - oss
    - enterprise
    - cloud
weight: 400
review_date: 2026-09-08
---

# Zabbix template variables

Template variables let you create dynamic, reusable dashboards that switch between host groups, hosts, applications, and items without editing the dashboard. You can populate variable drop-downs with values from Zabbix and reference those variables in queries, panel titles, and text panels.

## Before you begin

- [Configure the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/).
- Understand [Grafana template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/).

## Supported variable types

| Variable type | Supported | Description |
|---------------|-----------|-------------|
| Query | Yes | Fetch values from Zabbix (host groups, hosts, applications, items, etc.). |
| Custom | Yes | Define a custom list of values. |
| Data source | Yes | Switch between multiple Zabbix data source instances. |

## Create a query variable

To create a variable that fetches values from Zabbix:

1. Open a dashboard and click **Dashboard settings** (gear icon).
1. Click **Variables** in the left menu.
1. Click **Add variable**.
1. Set **Variable type** to **Query**.
1. Select the Zabbix data source.
1. Select a **Query Type** and fill in the filter fields.
1. Click **Apply**.

## Query types

The variable query editor uses a structured form with a **Query Type** drop-down. Select the type of Zabbix entity you want to populate the variable with.

| Query type | Returns | Filter fields |
|------------|---------|---------------|
| **Group** | Host group names | Group |
| **Host** | Host names | Group, Host |
| **Application** | Application names | Group, Host, Application. Not available on Zabbix 5.4+ where applications have been removed. Use **Item tag** instead. |
| **Item tag** | Item tag values | Group, Host, Item Tag. Available on Zabbix 5.4+. |
| **Item** | Item names | Group, Host, Application or Item Tag, Item |
| **Item values** | Current item values | Group, Host, Application or Item Tag, Item |

All filter fields support regex patterns (for example, `/.*/` to match all values) and references to other template variables (for example, `$group`).

For the **Item** and **Item values** query types, the editor shows either **Application** (Zabbix < 5.4) or **Item Tag** (Zabbix 5.4+) depending on your Zabbix server version. Only one field is visible at a time.

When the **Item** query type is selected, you can also toggle **Show disabled items** to include disabled items in the results.

## Legacy query format

Older dashboards may use a legacy string-based query format. The Zabbix variable editor displays these as a read-only **Legacy Query** field and automatically converts them to the structured format.

The legacy format uses four parts wrapped in braces:

```
{host group}{host}{application}{item name}
```

Each part can be a specific name or `*` (all values). The number of parts determines what the variable returns:

| Query | Returns |
|-------|---------|
| `{*}` | All host groups |
| `{*}{*}` | All hosts |
| `{Network}{*}` | All hosts in the "Network" group |
| `{Linux servers}{*}{*}` | All applications from hosts in "Linux servers" |
| `{Linux servers}{backend01}{CPU}{*}` | All items from backend01 in the CPU application |

## Use variables in queries

Reference variables in the query editor by prefixing the variable name with `$`. For example, if you have a variable named `host`, use `$host` in the **Host** field of a Metrics query.

Variables work in most query editor fields, including:

- **Group**, **Host**, **Application** / **Item tag**, **Item**
- **Service**, **SLA**
- **Proxy**, **Problem**, **Item Ids**, **Macros**
- Panel and row titles
- Text panel content

{{< admonition type="note" >}}
When using multi-value variables, the plugin automatically formats the selected values as a regex pattern for Zabbix API queries. For example, selecting `web01` and `web02` is sent to Zabbix as `(web01|web02)`.
{{< /admonition >}}

## Built-in macros

In addition to the template variables you define, the plugin automatically populates a set of read-only macros for each series returned by a **Metrics** query. Use them in alias functions (`setAlias`, `setAliasByRegex`, `replaceAlias`) to build readable series names. You don't create these macros; the plugin sets them per item.

| Macro | Value |
|-------|-------|
| `$__zbx_host` | Host technical name (the `host` field in Zabbix). |
| `$__zbx_host_name` | Host visible name (the `name` field in Zabbix). |
| `$__zbx_host_id` | Host ID. |
| `$__zbx_item` | Item name. |
| `$__zbx_item_name` | Item name. Same value as `$__zbx_item`. |
| `$__zbx_item_key` | Item key, for example `system.cpu.load`. |
| `$__zbx_item_interval` | Item update interval. |
| `$__zbx_item_tag_<tag>` | Value of the item tag named `<tag>`. Non-alphanumeric characters in the tag name are replaced with underscores, so a tag named `App Name` becomes `$__zbx_item_tag_App_Name`. When an item has multiple values for the same tag, they're joined with commas. |

For example, to rename each series to `<visible host name> - <item name>`, add the following function to a Metrics query:

```
setAlias($__zbx_host_name - $__zbx_item)
```

{{< admonition type="note" >}}
`$__zbx_host` returns the host's technical name, while `$__zbx_host_name` returns the visible name. These often differ. Use `$__zbx_host_name` when you want the human-readable name shown in the Zabbix frontend.
{{< /admonition >}}

## Chain variables

You can reference one variable inside another variable's query to create cascading drop-downs. For example:

1. Create a variable named `group` with **Query Type** set to **Group**.
1. Create a variable named `host` with **Query Type** set to **Host** and set the **Group** field to `$group`.
1. Create a variable named `item` with **Query Type** set to **Item**, set **Group** to `$group`, and **Host** to `$host`.

When you change the `group` selection, the `host` variable automatically updates to show only hosts in that group, and the `item` variable updates accordingly.

## Examples

### Build a host picker for a dashboard

Let viewers switch the dashboard between hosts without editing panels.

1. Create a variable named `host` with **Query Type** set to **Host** and **Group** set to the group you want (or `/.*/` for all hosts).
1. In each Metrics query, set the **Host** field to `$host`.

### Filter a query with a multi-value variable

Show several hosts on one panel from a single drop-down.

1. Create the `host` variable as in the previous example and enable **Multi-value**.
1. Set the **Host** field of your query to `$host`.

When you select `web01` and `web02`, the plugin sends `(web01|web02)` to Zabbix, so the query returns data for both hosts.

### Repeat a panel for each selected host

Render one copy of a panel per selected host.

1. Create a multi-value `host` variable.
1. In the panel's **Repeat options**, set **Repeat by variable** to `host`.
1. Set the query's **Host** field to `$host`.

Grafana renders a separate panel for each host you select.

### Populate a drop-down with current item values

Use the **Item values** query type to build a variable from the latest values of an item, which is useful for text panels or annotations.

1. Create a variable with **Query Type** set to **Item values**.
1. Set **Group**, **Host**, and **Item** to target the item you want.

## Next steps

- [Build queries with the Zabbix query editor](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/query-editor/)
- [Apply functions to transform query results](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/functions/)
