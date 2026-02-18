---
title: Configure the Zabbix data source
menuTitle: Configure
description: Learn how to configure the Zabbix data source for Grafana, including authentication, trends, Direct DB Connection, and provisioning.
aliases:
  - configuration/
  - configuration/direct-db-datasource/
  - configuration/provisioning/
keywords:
  - grafana
  - zabbix
  - data source
  - configuration
  - provisioning
  - direct db connection
labels:
  products:
    - oss
    - enterprise
    - cloud
weight: 200
last_reviewed: 2026-02-18
---

# Configure the Zabbix data source

This document explains how to configure the Zabbix data source in Grafana, including authentication, trends, Direct DB Connection, and provisioning.

## Before you begin

Before configuring the data source, ensure you have:

- **Grafana permissions:** Organization administrator role.
- **Zabbix API URL:** The full URL to your Zabbix API endpoint, including the `api_jsonrpc.php` path (for example, `http://zabbix.example.com/api_jsonrpc.php`).
- **Zabbix credentials:** A username and password for a Zabbix user, or an API token. Verify the user has permissions to access the host groups and hosts you want to query in Grafana.

## Add the data source

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `Zabbix` in the search bar.
1. Select **Zabbix**.
1. Click **Add new data source**.

## Configure connection settings

| Setting | Description |
|---------|-------------|
| **Name** | The display name for this data source instance. |
| **Default** | Toggle to make this the default data source for new panels. |
| **URL** | The full URL of your Zabbix API endpoint, including `api_jsonrpc.php`. For example: `http://zabbix.example.com/api_jsonrpc.php`. |

## Configure authentication

The Zabbix data source supports two authentication methods. Select the method in the **Auth type** drop-down under the **Zabbix Connection** section.

### User and password

Use a Zabbix user account to authenticate with the API.

| Setting | Description |
|---------|-------------|
| **Username** | The Zabbix username. |
| **Password** | The Zabbix password. Stored securely in Grafana. |

### API token

Use a Zabbix API token to authenticate. API tokens are available in Zabbix 5.4 and later.

| Setting | Description |
|---------|-------------|
| **API Token** | The Zabbix API token. Stored securely in Grafana. |

## Configure trends

Trends store aggregated historical data (average, minimum, and maximum per hour) and are recommended for displaying long time ranges. Enable trends to improve query performance when viewing data older than your history retention period. Find these settings under **Additional settings** > **Trends**.

| Setting | Description |
|---------|-------------|
| **Enable Trends** | Toggle to enable querying trends data for long time ranges. |
| **After** | Time after which trends are used instead of history. Set this to your history storage period. Default: `7d`. Valid time specifiers: `h` (hours), `d` (days), `M` (months). |
| **Range** | Time range width after which trends are used instead of history. Set this between 4 and 7 days to prevent loading large amounts of history data. Default: `4d`. |

## Configure Zabbix API settings

These settings control caching and connection behavior for the Zabbix API. Find them under **Additional settings** > **Zabbix API**.

| Setting | Description |
|---------|-------------|
| **Cache TTL** | How long the plugin caches metric names in memory. Default: `1h`. |
| **Timeout** | Zabbix API connection timeout in seconds. Default: `30`. |

### Query timeout

Under **Additional settings** > **Query Options**, you can set the maximum execution time for database queries initiated by the plugin.

| Setting | Description |
|---------|-------------|
| **Query Timeout** | Maximum execution time in seconds for database queries. Queries exceeding this limit are automatically terminated. Default: `60`. |

## Configure Direct DB Connection

Direct DB Connection lets the plugin query history and trend data directly from the Zabbix database through an existing Grafana SQL or InfluxDB data source. This bypasses the Zabbix API for historical data, which is faster on wide time ranges and reduces the amount of data transferred.

Find these settings under **Additional settings** > **Direct DB Connection**.

| Setting | Description |
|---------|-------------|
| **Enable Direct DB Connection** | Toggle to enable direct database queries for history data. |
| **Data Source** | Select an existing MySQL, PostgreSQL, or InfluxDB data source configured in Grafana that points to your Zabbix database. |
| **Retention Policy** | (InfluxDB only) The retention policy name for fetching long-term stored data. Leave blank if you use only the default retention policy. |

### Set up a database data source

Before enabling Direct DB Connection, you need a MySQL, PostgreSQL, or InfluxDB data source in Grafana that connects to your Zabbix database. The plugin uses this data source to execute history and trend queries.

To add a database data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Select **MySQL**, **PostgreSQL**, or **InfluxDB**.
1. Configure the connection to your Zabbix database. The database name is typically `zabbix`.
1. Click **Save & test**.

For detailed configuration, refer to the [MySQL](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/), [PostgreSQL](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/), or [InfluxDB](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/) data source documentation.

### Database security

The plugin needs only read access to the `history`, `history_uint`, `trends`, and `trends_uint` tables. To minimize data exposure, grant read access to only those tables. All queries run from the Grafana server, so you can also restrict connections to the Grafana host.

MySQL example:

```sql
GRANT SELECT ON zabbix.history TO 'grafana'@'<GRAFANA_HOST>' IDENTIFIED BY '<PASSWORD>';
GRANT SELECT ON zabbix.history_uint TO 'grafana'@'<GRAFANA_HOST>' IDENTIFIED BY '<PASSWORD>';
GRANT SELECT ON zabbix.trends TO 'grafana'@'<GRAFANA_HOST>' IDENTIFIED BY '<PASSWORD>';
GRANT SELECT ON zabbix.trends_uint TO 'grafana'@'<GRAFANA_HOST>' IDENTIFIED BY '<PASSWORD>';
```

If you also want to use this data source for other queries, you can grant `SELECT` privileges to the entire Zabbix database:

```sql
GRANT SELECT ON zabbix.* TO 'grafana'@'<GRAFANA_HOST>' IDENTIFIED BY '<PASSWORD>';
```

## Configure other settings

These settings are under **Additional settings** > **Other**.

| Setting | Description |
|---------|-------------|
| **Disable acknowledges for read-only users** | Prevents non-editor users from acknowledging problems in Grafana. |
| **Disable data alignment** | Disables automatic alignment of time series points to the start of their collection interval. Data alignment is required for stacked graphs to render correctly. You can also toggle this per query in the query options. |

## Verify the connection

Click **Save & test** to verify the connection. A successful test displays the message "Zabbix API version" followed by the detected version number. If Direct DB Connection is enabled, the message also includes the database connector type.

If the test fails, refer to the [troubleshooting guide](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/troubleshooting/) for common connection issues and solutions.

## Provision the data source

You can define and configure the Zabbix data source in YAML files as part of Grafana's provisioning system. For more information about provisioning, refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

The following example provisions a Zabbix data source with Direct DB Connection using a MySQL database:

```yaml
apiVersion: 1

datasources:
  - name: Zabbix
    type: alexanderzobnin-zabbix-datasource
    url: http://<ZABBIX_HOST>/zabbix/api_jsonrpc.php
    jsonData:
      authType: userLogin
      username: <ZABBIX_USERNAME>
      trends: true
      trendsFrom: '7d'
      trendsRange: '4d'
      cacheTTL: '1h'
      dbConnectionEnable: true
      dbConnectionDatasourceName: <DB_DATASOURCE_NAME>
      dbConnectionRetentionPolicy: ''
      disableReadOnlyUsersAck: false
      disableDataAlignment: false
    secureJsonData:
      password: <ZABBIX_PASSWORD>
    version: 1
    editable: false

  - name: MySQL Zabbix
    type: mysql
    url: <MYSQL_HOST>:3306
    user: <MYSQL_USER>
    jsonData:
      database: zabbix
    secureJsonData:
      password: <MYSQL_PASSWORD>
```

### Provisioning configuration options

The following table lists all available `jsonData` and `secureJsonData` fields for the Zabbix data source:

| Field | Type | Description |
|-------|------|-------------|
| `authType` | `jsonData` | Authentication method. Values: `userLogin` (default) or `token`. |
| `username` | `jsonData` | Zabbix username (for `userLogin` authentication). |
| `password` | `secureJsonData` | Zabbix password (for `userLogin` authentication). |
| `apiToken` | `secureJsonData` | Zabbix API token (for `token` authentication). |
| `trends` | `jsonData` | Enable trends. Default: `true`. |
| `trendsFrom` | `jsonData` | Time after which trends are used. Default: `7d`. |
| `trendsRange` | `jsonData` | Time range width for switching to trends. Default: `4d`. |
| `cacheTTL` | `jsonData` | Cache lifetime for metric names. Default: `1h`. |
| `timeout` | `jsonData` | Zabbix API connection timeout in seconds. Default: `30`. |
| `queryTimeout` | `jsonData` | Maximum execution time for database queries in seconds. Default: `60`. |
| `dbConnectionEnable` | `jsonData` | Enable Direct DB Connection. Default: `false`. |
| `dbConnectionDatasourceName` | `jsonData` | Name of the Grafana data source for the Zabbix database. |
| `dbConnectionRetentionPolicy` | `jsonData` | InfluxDB retention policy name for long-term data. |
| `disableReadOnlyUsersAck` | `jsonData` | Disable acknowledges for read-only users. Default: `false`. |
| `disableDataAlignment` | `jsonData` | Disable time series data alignment. Default: `false`. |

For detailed MySQL and PostgreSQL provisioning options, refer to the [MySQL provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/#provision-the-data-source) and [PostgreSQL provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/#provision-the-data-source) documentation.

### Provision with Terraform

You can provision the Zabbix data source using the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs). The following example creates a Zabbix data source with user and password authentication:

```hcl
resource "grafana_data_source" "zabbix" {
  type = "alexanderzobnin-zabbix-datasource"
  name = "Zabbix"
  url  = "http://<ZABBIX_HOST>/zabbix/api_jsonrpc.php"

  json_data_encoded = jsonencode({
    username             = "<ZABBIX_USERNAME>"
    trends               = true
    trendsFrom           = "7d"
    trendsRange          = "4d"
    cacheTTL             = "1h"
    dbConnectionEnable   = false
    disableDataAlignment = false
  })

  secure_json_data_encoded = jsonencode({
    password = "<ZABBIX_PASSWORD>"
  })
}
```

For more information about the Grafana Terraform provider, refer to the [Grafana provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).

## Next steps

- [Build queries with the Zabbix query editor](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/query-editor/)
- [Use template variables for dynamic dashboards](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/template-variables/)
- [Set up alerting rules](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/alerting/)
- [Troubleshoot the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/troubleshooting/)
