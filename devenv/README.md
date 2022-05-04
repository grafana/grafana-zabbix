# Development environment for the plugin

This docker environments contain preconfigured Zabbix instance with several monitored hosts and preconfigured Grafana with added data source and dashboards for testing. Environment uses plugin built
from sources, so in order to start environment, run commands from plugin root directory:

```shell
# Build plugin
make dist

# Test plugin with Zabbix 6.0
cd devenv/zabbix60
docker-compose up -d
```

If you want to edit sources, do it, rebuild plugin and then restart grafana container:

```shell
docker-compose restart grafana
```
