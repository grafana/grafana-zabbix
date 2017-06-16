# Zabbix plugin for Grafana

[![GitHub version](https://badge.fury.io/gh/alexanderzobnin%2Fgrafana-zabbix.svg)](https://github.com/alexanderzobnin/grafana-zabbix/releases)
[![Docs](https://img.shields.io/badge/docs-latest-red.svg?style=flat)](http://docs.grafana-zabbix.org)
[![Twitter URL](https://img.shields.io/twitter/url/http/shields.io.svg?style=social&label=Follow)](https://twitter.com/alexanderzobnin)
[![Donate](https://img.shields.io/badge/donate-paypal-2c9eda.svg?style=flat&colorA=0b3684)](https://paypal.me/alexanderzobnin/10)

Zabbix data source, Triggers panel and more.

<img width="640" alt="Dashboard" src="https://cloud.githubusercontent.com/assets/4932851/16547269/69d67380-4170-11e6-9724-ac8b53cd8b93.png">

## Features
  - Flexible metric editor with Regex support
  - Template variables support
  - Annotations support (show events on graph)
  - Triggers panel
  - Client-side metrics processing (Avg, Median, Min, Max, Multiply, Summarize, Time shift)

See features overview and dashboards examples at Grafana-Zabbix [Live demo](http://play.grafana-zabbix.org) site.
Visit [plugins page](https://grafana.com/plugins) at [grafana.com](http://grafana.com) and check out available Grafana data sources, panels and [dashboards](https://grafana.com/dashboards?dataSource=alexanderzobnin-zabbix-datasource).

## Installation
Install by using `grafana-cli`
```sh
grafana-cli plugins install alexanderzobnin-zabbix-app
```
Or see more installation options in [docs](http://docs.grafana-zabbix.org/installation/).

## Documentation
  - [About](http://docs.grafana-zabbix.org)
  - [Installation](http://docs.grafana-zabbix.org/installation)
  - [Getting Started](http://docs.grafana-zabbix.org/guides/gettingstarted)
  - [Templating](http://docs.grafana-zabbix.org/guides/templating)
  - [Alerting](http://docs.grafana-zabbix.org/reference/alerting/)
  - [Available functions](http://docs.grafana-zabbix.org/reference/functions/)

## Community Resources, Feedback, and Support
  - Found a bug? Want a new feature? Feel free to open an [issue](https://github.com/alexanderzobnin/grafana-zabbix/issues/new).
  - Have a question? You also can open issue, but for questions, it would be better to use [Grafana Community](https://community.grafana.com/) portal.
  - Need additional support? Contact me for details [alexanderzobnin@gmail.com](mailto:alexanderzobnin@gmail.com)

---
:copyright: 2015-2017 Alexander Zobnin alexanderzobnin@gmail.com

Licensed under the Apache 2.0 License
