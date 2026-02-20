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
last_reviewed: 2026-02-18
---

# Zabbix template variables

Template variables let you create dynamic, reusable dashboards that switch between host groups, hosts, applications, and items without editing the dashboard. You can populate variable drop-downs with values from Zabbix and reference those variables in queries, panel titles, and text panels.

## Before you begin

- [Configure the Zabbix data source](./configure/).
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
When using multi-value variables, the plugin automatically formats the selected values as a regex pattern for Zabbix API queries.
{{< /admonition >}}

## Chain variables

You can reference one variable inside another variable's query to create cascading drop-downs. For example:

1. Create a variable named `group` with **Query Type** set to **Group**.
1. Create a variable named `host` with **Query Type** set to **Host** and set the **Group** field to `$group`.
1. Create a variable named `item` with **Query Type** set to **Item**, set **Group** to `$group`, and **Host** to `$host`.

When you change the `group` selection, the `host` variable automatically updates to show only hosts in that group, and the `item` variable updates accordingly.

## Next steps

- [Build queries with the Zabbix query editor](./query-editor/)
- [Apply functions to transform query results](./functions/)
