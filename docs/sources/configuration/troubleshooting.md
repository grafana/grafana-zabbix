---
title: Troubleshooting
menuTitle: Troubleshooting
description: Troubleshooting guide for Grafana-Zabbix plugin.
aliases:
keywords:
  - data source
  - zabbix
labels:
  products:
    - oss
    - grafana cloud
weight: 330
---

# Troubleshooting

This guide covers common issues and their solutions when using the Grafana-Zabbix plugin.

## Connection Issues

### "Zabbix API request failed" or Connection Timeout

**Symptoms:** Unable to connect to Zabbix, timeout errors, or API request failures.

**Solutions:**

1. **Verify Zabbix API URL:**
   - Ensure the URL ends with `/api_jsonrpc.php`
   - Example: `http://your-zabbix-server/zabbix/api_jsonrpc.php`

2. **Check credentials:**
   - Verify username and password are correct
   - Ensure the user has API access permissions in Zabbix

3. **Network connectivity:**
   - Confirm Grafana server can reach the Zabbix server
   - Check firewall rules and proxy settings

4. **SSL/TLS issues:**
   - If using HTTPS, ensure certificates are valid
   - Try enabling "Skip TLS Verify" for testing (not recommended for production)

### "Authentication failed" Error

**Solutions:**

1. Verify the Zabbix user has the correct permissions
2. Check if the user account is not disabled or locked
3. Ensure API access is enabled for the user group in Zabbix

## Data Display Issues

### No Data Showing in Panels

**Solutions:**

1. **Verify time range:** Ensure the selected time range contains data
2. **Check host/item selection:** Confirm hosts and items are correctly selected
3. **Test in Zabbix:** Verify the data exists in Zabbix itself
4. **Check item types:** Some item types may require specific configurations

### Incorrect or Missing Metrics

**Solutions:**

1. **Refresh the cache:** Go to Data Source settings and click "Clear cache"
2. **Check regex patterns:** If using regex for host/item selection, verify the patterns
3. **Verify item keys:** Ensure item keys match exactly as shown in Zabbix

## Performance Issues

### Slow Dashboard Loading

**Solutions:**

1. **Reduce query scope:**
   - Use more specific host groups and hosts
   - Limit the number of items per query

2. **Optimize time range:**
   - Avoid very long time ranges with high-resolution data
   - Use appropriate aggregation intervals

3. **Enable caching:**
   - Configure appropriate cache TTL in data source settings

4. **Use Direct DB Connection:**
   - For large-scale deployments, consider using [Direct DB Connection](./direct-db-datasource.md)

### High Memory Usage

**Solutions:**

1. Reduce the number of concurrent queries
2. Use more specific filters in queries
3. Consider using the Direct DB Connection for heavy workloads

## Plugin Issues

### Plugin Not Loading After Update

**Solutions:**

1. **Restart Grafana:**
   ```bash
   sudo systemctl restart grafana-server
   ```

2. **Clear browser cache:** Hard refresh the browser (Ctrl+Shift+R)

3. **Check plugin installation:**
   ```bash
   grafana-cli plugins ls | grep zabbix
   ```

4. **Reinstall if needed:**
   ```bash
   grafana-cli plugins remove alexanderzobnin-zabbix-app
   grafana-cli plugins install alexanderzobnin-zabbix-app
   sudo systemctl restart grafana-server
   ```

### Backend Plugin Errors

If you see errors related to the backend plugin:

1. Check Grafana server logs:
   ```bash
   sudo journalctl -u grafana-server -f
   ```

2. Verify the plugin backend binary has execute permissions
3. Ensure the system meets the plugin's requirements

## Getting Help

If the above solutions don't resolve your issue:

1. **Search existing issues:** Check [GitHub Issues](https://github.com/grafana/grafana-zabbix/issues) for similar problems
2. **Collect diagnostic information:**
   - Grafana version
   - Plugin version
   - Zabbix version
   - Browser console errors (F12 → Console)
   - Grafana server logs
3. **Open a support issue:** Create a new [GitHub Issue](https://github.com/grafana/grafana-zabbix/issues/new) with the collected information

See also [Grafana troubleshooting](http://docs.grafana.org/installation/troubleshooting/) for general Grafana issues.
