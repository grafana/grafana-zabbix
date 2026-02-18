---
title: Troubleshoot Zabbix data source issues
menuTitle: Troubleshooting
description: Solutions to common issues with the Zabbix data source plugin for Grafana.
aliases:
  - configuration/troubleshooting/
keywords:
  - grafana
  - zabbix
  - troubleshooting
  - errors
  - authentication
  - query
labels:
  products:
    - oss
    - enterprise
    - cloud
weight: 600
last_reviewed: 2026-02-18
---

# Troubleshoot Zabbix data source issues

This page provides solutions to common issues you may encounter when configuring or using the Zabbix data source. For configuration instructions, refer to [Configure the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/).

## Authentication errors

These errors occur when credentials are invalid, missing, or don't have the required permissions.

### "Login name or password is incorrect" or "Authorization failed"

**Symptoms:**

- **Save & test** fails with an authorization error.
- Queries return empty results or access denied messages.
- Group and host drop-downs are empty.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| Incorrect username or password | Verify the username and password in the data source configuration. Test the credentials by logging into the Zabbix web interface directly. |
| Wrong authentication type selected | Confirm that the **Auth type** drop-down matches your credentials. Use **User and password** for username/password, or **API token** for token-based authentication. |
| Zabbix user lacks permissions | Verify the user has read access to the host groups and hosts you want to query. In Zabbix, navigate to **Administration** > **Users** to check permissions. |
| API token expired or revoked | Generate a new API token in the Zabbix web interface and update the data source configuration. |

### "No API access" or empty drop-downs

**Symptoms:**

- The data source test succeeds, but group, host, or item drop-downs are empty.
- Queries return no data despite the connection being valid.

**Solutions:**

1. Verify the Zabbix user belongs to a user group with frontend access enabled.
1. Check that the user group has read permissions on the host groups you want to query.
1. In the Zabbix web interface, navigate to **Administration** > **User groups** and verify the permissions tab for the relevant user group.

## Connection errors

These errors occur when Grafana can't reach the Zabbix API endpoint.

### "Connection refused" or timeout errors

**Symptoms:**

- **Save & test** times out or returns a connection error.
- Queries fail with network errors.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| Incorrect URL | Verify the URL includes the full path to the Zabbix API endpoint, including `api_jsonrpc.php`. For example: `http://zabbix.example.com/api_jsonrpc.php`. |
| Missing `api_jsonrpc.php` in the URL | Append `/api_jsonrpc.php` to the URL. A common mistake is providing only the Zabbix web interface URL without the API path. |
| Firewall or network restrictions | Verify the Grafana server can reach the Zabbix server on the configured port. Check firewall rules for outbound HTTP/HTTPS access. |
| HTTPS certificate issues | If using HTTPS, verify the certificate is valid. To skip TLS verification (not recommended for production), enable **Skip TLS Verify** in the data source configuration. |
| Zabbix API disabled | Verify the Zabbix API is enabled. In newer versions of Zabbix, the API is enabled by default, but it may be restricted by web server configuration. |

### Proxy or CORS errors

**Symptoms:**

- Browser console shows CORS-related errors.
- Queries fail when using "Browser" access mode.

**Solutions:**

1. Use **Server** access mode (the default) so that all API requests go through the Grafana backend rather than the browser.
1. If you must use browser access, configure your Zabbix web server to allow CORS requests from the Grafana origin.

## Query errors

These errors occur when executing queries against the Zabbix data source.

### "No data" or empty results

**Symptoms:**

- Queries execute without error but return no data.
- Panels show a "No data" message.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| Time range doesn't contain data | Expand the dashboard time range or verify data exists in Zabbix for the selected period. |
| Wrong group, host, or item selected | Verify you've selected the correct host group, host, and item. Check that the item has recent data in the Zabbix web interface under **Monitoring** > **Latest data**. |
| Trends misconfiguration | If querying a long time range, verify trends are enabled and the **After** and **Range** settings match your Zabbix history and trends retention periods. |
| Disabled items | Enable **Show disabled items** in the query options if you need to query items that are currently disabled in Zabbix. |
| Permissions issue | Verify the Zabbix user has read access to the specific host group and host. |

### Query timeout

**Symptoms:**

- Queries run for a long time and then fail.
- Error messages mention timeout or execution limits.

**Solutions:**

1. Narrow the dashboard time range to reduce the amount of data returned.
1. Enable trends for long time ranges to use pre-aggregated data instead of raw history.
1. Enable [Direct DB Connection](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/#configure-direct-db-connection) for better performance on wide time ranges.
1. Increase the **Timeout** or **Query Timeout** values in the data source configuration if the defaults are too low for your environment.
1. Use `groupBy` or `consolidateBy` functions to reduce the data point density.

### Incorrect data or unexpected values

**Symptoms:**

- Graph values don't match what Zabbix shows.
- Data appears shifted or aggregated differently.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| Data alignment | The plugin aligns data points to collection intervals by default, which may shift timestamps slightly. Disable **Disable data alignment** in the query options or data source configuration if you need exact Zabbix timestamps. |
| Trends vs. history mismatch | For long time ranges, the plugin switches to trends data, which contains hourly aggregates (avg, min, max). Use the `trendValue` function to select the specific trend value type. |
| Wrong `consolidateBy` function with Direct DB Connection | When using Direct DB Connection, the default aggregation is `AVG`. Use `consolidateBy(max)` with `groupBy(interval, max)` to get accurate maximum values. |

## Direct DB Connection errors

These errors are specific to the Direct DB Connection feature.

### "Database connection failed" or SQL errors

**Symptoms:**

- Queries fail after enabling Direct DB Connection.
- Error messages reference database connection or SQL syntax issues.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| Wrong data source selected | Verify the data source selected in the **Data Source** drop-down points to the correct Zabbix database. |
| Database permissions | Verify the database user has `SELECT` access to the `history`, `history_uint`, `trends`, and `trends_uint` tables. |
| Database data source not configured | The selected MySQL, PostgreSQL, or InfluxDB data source must be configured and working independently. Test it by running a query directly against that data source. |
| InfluxDB retention policy | If using InfluxDB, verify the **Retention Policy** name matches the one configured in your InfluxDB instance. Leave it blank if using only the default retention policy. |

## Template variable errors

These errors occur when using template variables with the Zabbix data source.

### Variables return no values

**Solutions:**

1. Verify the data source connection is working by clicking **Save & test** in the data source settings.
1. Check that the Zabbix user has permissions to list the requested resources (host groups, hosts, items).
1. For cascading variables, verify that parent variables have valid selections. For example, a **Host** variable that filters by `$group` returns no results if `$group` has no selection.
1. Check that regex filters in the variable query are valid. An invalid regex pattern may silently match nothing.

### Variables are slow to load

**Solutions:**

1. Set the variable refresh to **On dashboard load** instead of **On time range change** to avoid reloading on every time range adjustment.
1. Use specific group or host filters instead of `/.*/` to narrow the scope of variable queries.
1. Increase the **Cache TTL** in the data source configuration to reduce the frequency of API calls for metric names.

## Performance issues

These issues relate to slow queries or high resource usage.

### Slow queries on wide time ranges

**Symptoms:**

- Dashboards take a long time to load when viewing weeks or months of data.
- Panels time out or show loading spinners for extended periods.

**Solutions:**

1. Enable trends in the data source configuration. Trends use pre-aggregated hourly data, which dramatically reduces the data volume for long time ranges.
1. Set the **After** value to match your Zabbix history retention period (for example, `7d` or `30d`).
1. Enable [Direct DB Connection](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/#configure-direct-db-connection) for server-side aggregation, which reduces data transfer.
1. Use `groupBy` functions to reduce the data point density for very long time ranges.
1. Reduce the number of items queried by using more specific filters instead of broad regex patterns like `/.*/`.

### High API load on Zabbix server

**Solutions:**

1. Increase the **Cache TTL** to reduce the frequency of metadata API calls.
1. Reduce the dashboard auto-refresh interval.
1. Enable Direct DB Connection to offload history queries from the Zabbix API.
1. Avoid using `/.*/` regex in multiple variable queries, as each one triggers a broad API request.

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the Grafana configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Restart Grafana.
1. Reproduce the issue and review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for entries containing `zabbix` for plugin-specific request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried the solutions in this guide and still encounter issues:

1. Search the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review [open and closed issues on GitHub](https://github.com/grafana/grafana-zabbix/issues) for known bugs and workarounds.
1. Consult the [Zabbix documentation](https://www.zabbix.com/documentation/) for Zabbix-specific configuration guidance.
1. Contact [Grafana Support](https://grafana.com/support/) if you're an Enterprise, Cloud Pro, or Cloud Contracted user.
1. When reporting issues, include:
   - Grafana version and Zabbix plugin version
   - Zabbix server version
   - Error messages (redact sensitive information)
   - Steps to reproduce the issue
   - Relevant data source configuration (redact credentials)
