# Development environment for the plugin

> **Note:** For most development and for end-to-end tests, prefer the canonical
> environment at the repo root: `yarn server` (see [CONTRIBUTING.md](../CONTRIBUTING.md)),
> which switches Zabbix version via `ZABBIX_VERSION`. The per-version stacks here are
> kept for richer, version-specific scenarios — TLS + HTTP basic auth (5.0/6.0/7.0)
> and Zabbix proxy (5.0) — and are what the `compatibility-*` workflows run against.

This docker environment contains preconfigured Zabbix instance with several monitored hosts and preconfigured Grafana with added data source and dashboards for testing. Environment uses plugin built
from sources, so in order to start environment, run commands from plugin root directory:

```shell
# Build plugin
make dist

# Test plugin with Zabbix 6.0
cd devenv/zabbix60
docker-compose up -d
```

Run bootstrap again in case of error:

```shell
docker-compose up -d --build bootstrap
```

Grafana will be available at `http://localhost:3000` (with default `admin:admin` credentials).

If you want to edit sources, do it, rebuild plugin and then restart grafana container:

```shell
docker-compose restart grafana
```
