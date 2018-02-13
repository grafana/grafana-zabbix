# Zabbix plugin for Grafana

[![GitHub version](https://badge.fury.io/gh/alexanderzobnin%2Fgrafana-zabbix.svg)](https://github.com/alexanderzobnin/grafana-zabbix/releases)
[![CircleCI](https://circleci.com/gh/alexanderzobnin/grafana-zabbix.svg?style=shield)](https://circleci.com/gh/alexanderzobnin/grafana-zabbix)
[![codecov](https://codecov.io/gh/alexanderzobnin/grafana-zabbix/branch/master/graph/badge.svg)](https://codecov.io/gh/alexanderzobnin/grafana-zabbix)
[![Change Log](https://img.shields.io/badge/change-log-blue.svg?style=flat)](https://github.com/alexanderzobnin/grafana-zabbix/blob/master/CHANGELOG.md)
[![Docs](https://img.shields.io/badge/docs-latest-red.svg?style=flat)](http://docs.grafana-zabbix.org)
[![Twitter URL](https://img.shields.io/twitter/url/http/shields.io.svg?style=social&label=Follow)](https://twitter.com/alexanderzobnin)
[![Donate](https://img.shields.io/badge/donate-paypal-2c9eda.svg?style=flat&colorA=0b3684)](https://paypal.me/alexanderzobnin/10)

Visualize your Zabbix metrics with the leading open source software for time series analytics.

<img width="640" alt="Dashboard" src="https://cloud.githubusercontent.com/assets/4932851/16547269/69d67380-4170-11e6-9724-ac8b53cd8b93.png">

## Features

- Select multiple metrics [by using Regex](http://docs.grafana-zabbix.org/guides/gettingstarted/#multiple-items-on-one-graph)
- Create interactive and reusable dashboards with [template variables](http://docs.grafana-zabbix.org/guides/templating/)
- Show events on graphs with [Annotations](http://docs.grafana.org/reference/annotations/)
- Display active problems with Triggers panel
- Transform and shape your data with [metric processing functions](http://docs.grafana-zabbix.org/reference/functions/) (Avg, Median, Min, Max, Multiply, Summarize, Time shift, Alias)
- Find problems faster with [Alerting](http://docs.grafana-zabbix.org/reference/alerting/) feature
- Mix metrics from multiple data sources in the same dashboard or even graph
- Discover and share [dashboards](https://grafana.com/dashboards) in the official library

See all features overview and dashboards examples at Grafana-Zabbix [Live demo](http://play.grafana-zabbix.org) site.
Visit [plugins page](https://grafana.com/plugins) at [grafana.com](http://grafana.com) and check out available Grafana data sources, panels and [dashboards](https://grafana.com/dashboards?dataSource=alexanderzobnin-zabbix-datasource).

## Installation

Install by using `grafana-cli`

```sh
grafana-cli plugins install alexanderzobnin-zabbix-app
```

Or see more installation options in [docs](http://docs.grafana-zabbix.org/installation/).

## Getting started

First, [configure](http://docs.grafana-zabbix.org/installation/configuration/) Zabbix data source. Then you can create your first dashboard with step-by-step [Getting started guide](http://docs.grafana-zabbix.org/guides/gettingstarted/).

## Documentation

- [About](http://docs.grafana-zabbix.org)
- [Installation](http://docs.grafana-zabbix.org/installation)
- [Getting Started](http://docs.grafana-zabbix.org/guides/gettingstarted)
- [Templating](http://docs.grafana-zabbix.org/guides/templating)
- [Alerting](http://docs.grafana-zabbix.org/reference/alerting/)
- [Metric processing functions](http://docs.grafana-zabbix.org/reference/functions/)

## Community Resources, Feedback, and Support

- Found a bug? Want a new feature? Feel free to open an [issue](https://github.com/alexanderzobnin/grafana-zabbix/issues/new).
- Have a question? You also can open issue, but for questions, it would be better to use [Grafana Community](https://community.grafana.com/) portal.
- Need additional support? Contact me for details [alexanderzobnin@gmail.com](mailto:alexanderzobnin@gmail.com)

---
:copyright: 2015-2018 Alexander Zobnin alexanderzobnin@gmail.com

Licensed under the Apache 2.0 License
