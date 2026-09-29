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
review_date: 2026-09-08
---

# Troubleshoot Zabbix data source issues

This page provides solutions to common issues you may encounter when configuring or using the Zabbix data source. For configuration instructions, refer to [Configure the Zabbix data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/).

## Setup errors

These issues occur before you can add or use the data source.

### Zabbix doesn't appear when adding a data source

**Symptoms:**

- **Zabbix** isn't listed under **Connections** > **Add new connection**.
- You can't create a new Zabbix data source.

**Cause:**

Zabbix is an app plugin. Installing the plugin isn't enough. You must also enable it before the data source becomes available.

**Solutions:**

1. Go to **Administration** > **Plugins and data** > **Plugins** and select the **Zabbix** plugin.
1. Confirm the plugin is installed. If it isn't, click **Install**.
1. On the plugin page, click **Enable**.
1. Return to **Connections** > **Add new connection** and search for **Zabbix** again.

For step-by-step instructions, refer to [Install and enable the Zabbix plugin](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/#install-and-enable-the-zabbix-plugin).

### The Zabbix backend plugin fails to start

**Symptoms:**

- **Save & test** returns "Plugin unavailable" or a generic server error.
- The Grafana logs show the backend plugin failing to start, for example a `failed to start plugin` or `permission denied` message for `gpx_zabbix-datasource`.
- The data source stops working after a Grafana upgrade or a migration to a new host.

**Cause:**

The Zabbix data source has a backend component, the `gpx_zabbix-datasource` executable. Grafana can't run it if the file lacks execute permission, the plugins directory is mounted with `noexec`, or a security policy such as SELinux blocks execution.

**Solutions:**

1. Verify the plugin files are owned by the Grafana user and that the executable has execute permission. Reinstalling the plugin from the catalog restores the correct files and permissions.
1. Make sure the Grafana plugins directory isn't mounted with the `noexec` option.
1. If you use SELinux or a similar system, allow Grafana to execute files in the plugins directory.
1. Restart Grafana after you correct the permissions.

## Plugin version and compatibility issues

Many problems are caused by running an outdated plugin or by leftover files from an old installation. Because the plugin updates independently of Grafana, keeping it current resolves a large share of issues, including data source load errors, incorrect data, high load on the Zabbix server, and AngularJS compatibility failures.

### Keep the Zabbix plugin up to date

Grafana doesn't update plugins automatically in self-managed instances, so an old plugin can persist across Grafana upgrades. To check your version and update:

1. Go to **Administration** > **Plugins and data** > **Plugins** and select the **Zabbix** plugin.
1. Compare the installed version with the latest version on the [Zabbix plugin catalog page](https://grafana.com/grafana/plugins/alexanderzobnin-zabbix-app/).
1. If an update is available, click **Update**.
1. Restart Grafana if prompted, then reload your dashboards.

Confirm you're using the official plugin. The app plugin ID is `alexanderzobnin-zabbix-app`, and its data source type is `alexanderzobnin-zabbix-datasource`. Installing from unofficial sources or manually copying old builds can leave you on an unsupported version.

{{< admonition type="note" >}}
In Grafana Cloud, the plugin is kept up to date for you.
{{< /admonition >}}

### "Angular plugins are not supported" or the plugin fails to load

AngularJS support was disabled by default in Grafana 11 and permanently removed in Grafana 12. Plugin versions before 4.3.0 were Angular-based and no longer load. The current plugin is React-based and requires Grafana 11.6.0 or later.

**Symptoms:**

- The data source shows the message "Angular plugins are not supported".
- The plugin doesn't appear as installed, or panels show "Panel plugin not found" or "Error loading" errors.
- The plugin worked before a Grafana upgrade and stopped working afterward.

**Cause:**

You're running an Angular-based plugin version from before 4.3.0, or stale files from a previous installation cause Grafana to mis-detect the plugin as Angular.

**Solutions:**

1. Update the Zabbix plugin to a current React-based version. The minimum React version is 4.3.0, but use the latest. The current plugin requires Grafana 11.6.0 or later.
1. If Grafana still reports Angular after you update, remove the plugin directory completely and reinstall a fresh copy from the plugin catalog to clear stale files.
1. Don't rely on `angular_support_enabled` in `grafana.ini`. This setting has no effect in Grafana 12, and the current React plugin doesn't need it.
1. Restart Grafana, then enable the plugin under **Administration** > **Plugins and data** > **Plugins**.

### "Could not find plugin definition for data source"

**Symptoms:**

- Panels show the message "Could not find plugin definition for data source".
- The Grafana logs contain `Could not find plugin definition for data source` with `datasource_type=alexanderzobnin-zabbix-datasource`.

**Cause:**

The plugin isn't installed or enabled, or a stale installation left the data source type registered without a matching plugin.

**Solutions:**

1. Verify the plugin is installed and enabled under **Administration** > **Plugins and data** > **Plugins**.
1. Update to the latest version. If the error persists, remove the old plugin directory and reinstall a fresh copy from the catalog.
1. Restart Grafana so it re-registers the data source type.

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

### "invalid character" or HTML returned instead of JSON

**Symptoms:**

- **Save & test** or queries fail with an error such as "invalid character '<' looking for beginning of value".
- The connection works against a direct Zabbix URL but fails through a load balancer or reverse proxy.

**Cause:**

The Zabbix API endpoint returned HTML or XML instead of JSON. This usually means the request reached a login page, an error page, or a proxy or load balancer response rather than `api_jsonrpc.php`. The plugin expects a JSON-RPC response and can't parse HTML.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| URL points to the web interface, not the API | Verify the URL ends with `/api_jsonrpc.php` and returns JSON when you request it directly. |
| Load balancer or reverse proxy returns an error or login page | Confirm the proxy forwards requests to the Zabbix API unchanged, preserves the request method and body, and doesn't inject an authentication page. |
| Web server or web application firewall blocks API requests | Allow the Grafana server to reach `api_jsonrpc.php` and exempt it from rules that return HTML challenge pages. |

### TLS handshake timeout

**Symptoms:**

- **Save & test** or queries fail with a TLS handshake timeout.
- The failure is intermittent or started after a network or certificate change.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| Network path or firewall blocks or throttles the connection | Verify the Grafana server can reach the Zabbix host and port. Check firewall, proxy, and load balancer rules along the path. |
| TLS interception or protocol mismatch | Verify the certificate chain and confirm the Zabbix endpoint supports the TLS version that Grafana negotiates. |
| Zabbix reachable only on a private network | Use Private Data Source Connect (PDC) to reach a Zabbix server that isn't exposed to Grafana Cloud. Refer to [Connect through Private Data Source Connect](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/#connect-through-private-data-source-connect). |

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

### Account blocked after repeated failed logins

**Symptoms:**

- Authentication suddenly fails even though the credentials are correct.
- The Zabbix server logs show the user or IP address as blocked.
- The problem started after a credential change or a burst of failed requests.

**Cause:**

Zabbix temporarily blocks a user after several consecutive failed login attempts as brute-force protection. Repeated failed logins from Grafana, for example after a password change or when many panels retry with stale credentials, can trigger this block.

**Solutions:**

1. Correct the credentials in the data source configuration, then wait for the block to expire before you retry.
1. Use an API token instead of a username and password to avoid login-attempt limits. Refer to [Configure authentication](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/#configure-authentication).
1. Update the plugin to a current version. Older versions opened many more connections and sessions per dashboard load, which made login-limit blocks more likely.
1. In Zabbix, review the failed-login settings and unblock the user if needed.

### Authentication fails or logs show an "/auth" deprecation on Zabbix 7.0 or later

**Symptoms:**

- Authentication fails against Zabbix 7.0 or later.
- The Zabbix web server logs show a deprecation warning for the `/auth` property.

**Cause:**

Zabbix 7.0 deprecated the `auth` request parameter and replaced it with the `Authorization` HTTP header. Older plugin versions still send the deprecated parameter.

**Solutions:**

1. Update the plugin. Current versions automatically send the API token in the `Authorization` header for Zabbix 7.0 and later.
1. If you place Zabbix behind a reverse proxy that uses HTTP basic authentication, the plugin keeps the token in the request body, as Zabbix requires. Confirm the proxy forwards the basic authentication credentials correctly.

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
| Zabbix data collection or clock issue | Items can show no values because of a Zabbix-side collection error or a clock difference between the monitored host and the Zabbix server. Check the item status and any errors in Zabbix under **Monitoring** > **Latest data**, and verify the host and server clocks are synchronized. This is a Zabbix data problem, not a Grafana one. |

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

### Host name shows the technical name instead of the visible name

**Symptoms:**

- Legends or alias functions show the technical host name when you expected the visible name, or the reverse.
- Both names look identical.

**Cause:**

The plugin exposes two separate host-name alias tokens. `$__zbx_host` resolves to the Zabbix technical host name, and `$__zbx_host_name` resolves to the visible name. If a host has no separate visible name configured in Zabbix, both tokens return the same value, so they appear identical.

**Solutions:**

1. Use `$__zbx_host_name` for the visible name and `$__zbx_host` for the technical name in `setAlias` and `replaceAlias`. Refer to [Alias functions](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/functions/#alias-functions).
1. To distinguish the two names, set a visible name on the host in Zabbix under **Data collection** > **Hosts**.

### Combine or calculate across multiple series

**Symptoms:**

- A Grafana transformation can't dynamically add or calculate values across paired or related series, such as summing matching metrics from two devices.

**Cause:**

Grafana transformations and the plugin's aggregate functions operate on the series returned by the query. They don't perform arbitrary per-pair math across independently queried series.

**Solutions:**

1. Use the plugin's aggregate functions where they fit. For example, `sumSeries` adds all series together, and `aggregateBy(interval, function)` combines series by a consolidation function. Refer to [Aggregate functions](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/functions/#aggregate-functions).
1. For calculations that transformations can't express, pre-calculate the value in Zabbix with a calculated item, then query that item in Grafana. This is more efficient and keeps the logic in one place.

### Problems panel shows the same value for every problem of a trigger

**Symptoms:**

- In the Problems panel, all active problems from the same trigger show the same current item value, `{ITEM.VALUE}`, or operational data.

**Cause:**

By default, the plugin doesn't resolve each problem's item value at its creation time, so it shows the current value. This lookup is disabled by default because it queries `history.get` for every problem, which can overload the Zabbix database in large environments.

**Solutions:**

1. Enable the **Item value at problem time** query option to resolve each problem's item value at its creation time. Refer to [Problems](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/query-editor/#problems).
1. Leave the option off if you have many active problems and don't need per-problem historical values, to protect Zabbix from extra load.
1. Update the plugin. Version 6.4.1 and later bound the history window and result size when the option is enabled.

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

### Memory-intensive queries overload the Zabbix server

**Symptoms:**

- A dashboard or query consumes excessive memory on the Zabbix server.
- The Zabbix frontend or database becomes unresponsive under normal dashboard load.

**Solutions:**

1. Update the plugin to the latest version. Recent releases fixed issues that multiplied API requests and enabled an expensive per-problem history lookup by default, both of which could exhaust Zabbix server resources. Restart Grafana after you update.
1. Keep the **Item value at problem time** query option off unless you need it, and set a **Limit** on Problems queries to cap the number of results.
1. Enable trends and Direct DB Connection so wide time ranges use pre-aggregated data and server-side aggregation.
1. Narrow queries with specific group, host, and item filters instead of broad regex patterns like `/.*/`.

## Upgrade and Infrastructure as Code issues

These issues appear after upgrading the plugin, especially when the data source is managed through provisioning or Infrastructure as Code (IaC).

### Dashboards break after reinstalling or recreating the data source

**Symptoms:**

- After a plugin reinstall, a major version jump, or an IaC redeploy, panels show a data source not found error or reference an unknown data source.
- The data source works, but existing dashboards no longer point to it.

**Cause:**

Grafana identifies a data source by its UID. If a reinstall or IaC run deletes and recreates the data source without a fixed UID, Grafana assigns a new one, and dashboards that reference the old UID break.

**Solutions:**

Pin a stable `uid` for the data source in your provisioning YAML so it survives reinstallation and redeployment:

```yaml
datasources:
  - name: Zabbix
    type: alexanderzobnin-zabbix-datasource
    uid: zabbix-main
```

If the UID already changed, either restore the previous UID in provisioning or update the affected dashboards to reference the new UID. Managing the data source entirely through provisioning keeps its configuration and UID reproducible. For provisioning details, refer to [Provision the data source](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/#provision-the-data-source).

### Automation breaks after upgrading

**Symptoms:**

- Automation or scripts that referenced a data source by numeric ID stop working after an upgrade.
- Direct DB Connection can't find its database data source after an upgrade.

**Cause:**

The plugin references data sources by UID instead of the deprecated numeric ID. Automation and provisioning that used numeric IDs, including the Direct DB Connection database reference, must use the UID or name.

**Solutions:**

1. Update automation and provisioning to reference data sources by `uid` or `name` instead of numeric `id`.
1. For Direct DB Connection, set `dbConnectionDatasourceName`, or the database data source UID, rather than a numeric ID. The deprecated `dbConnectionDatasourceId` field is kept only to migrate older configurations.
1. Test the upgrade in a non-production environment before you roll it out through IaC.

### Performance regression after an upgrade

**Symptoms:**

- Zabbix server load or dashboard latency increases noticeably after a plugin update.
- The Problems panel is slow or overloads the Zabbix database in large environments.

**Cause:**

Older releases fetched a historical item value for every problem, which could overload the Zabbix frontend and database. This behavior is off by default in current releases.

**Solutions:**

1. Update to the latest plugin version. The per-problem historical value lookup is disabled by default in version 6.4.1 and later, which restores the earlier performance.
1. Leave the **Item value at problem time** query option off unless you specifically need item values resolved at each problem's creation time.
1. Prefer updating over rolling back. Rolling back reintroduces bugs that later releases fixed, such as the connection storm that caused 502 and 503 errors under normal load.

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
