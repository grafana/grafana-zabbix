# Zabbix plugin for Grafana

[![Version](https://badge.fury.io/gh/grafana%2Fgrafana-zabbix.svg)](https://github.com/grafana/grafana-zabbix/releases)
[![Change Log](https://img.shields.io/badge/change-log-blue.svg?style=flat)](https://github.com/grafana/grafana-zabbix/blob/main/CHANGELOG.md)
[![Docs](https://img.shields.io/badge/docs-latest-red.svg?style=flat)](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/)

![Dashboard](https://user-images.githubusercontent.com/4932851/53799185-e1cdc700-3f4a-11e9-9cb4-8330f501b32e.png)

## Features

- Select multiple metrics [by using Regex](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/guides/#multiple-items-on-one-graph)
- Create interactive and reusable dashboards with [template variables](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/guides/templating/)
- Show events on graphs with [Annotations](http://docs.grafana.org/reference/annotations/)
- Display active problems with Triggers panel
- Transform and shape your data with [metric processing functions](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/reference/functions/) (Avg, Median, Min, Max, Multiply, Summarize, Time shift, Alias)
- Find problems faster with [Alerting](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/reference/alerting/) feature
- Mix metrics from multiple data sources in the same dashboard or even graph
- Per user authentication using Bearer tokens, so that Grafana respects the RBAC on Zabbix
- Discover and share [dashboards](https://grafana.com/dashboards) in the official library

See all features overview and dashboards examples at Grafana-Zabbix [Live demo](http://play.grafana-zabbix.org) site.
Visit [plugins page](https://grafana.com/plugins) at [grafana.com](http://grafana.com) and check out available Grafana data sources, panels and [dashboards](https://grafana.com/dashboards?dataSource=alexanderzobnin-zabbix-datasource).

## Installation

Install by using `grafana-cli`

```sh
grafana-cli plugins install alexanderzobnin-zabbix-app
```

Or see more installation options in [docs](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/installation/).

## Getting started

First, [configure](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configuration/) Zabbix data source. Then you can create your first dashboard with step-by-step [Getting started guide](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/guides/).

## Documentation

- [About](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/)
- [Installation](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/installation)
- [Getting Started](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/guides)
- [Templating](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/guides/templating)
- [Alerting](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/reference/alerting/)
- [Metric processing functions](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/reference/functions/)

## Community Resources, Feedback, and Support

- Found a bug? Want a new feature? Feel free to open an [issue](https://github.com/grafana/grafana-zabbix/issues/new).
- Have a question? You also can open issue, but for questions, it would be better to use [Grafana Community](https://community.grafana.com/) portal.
