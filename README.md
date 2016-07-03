# Zabbix plugin for Grafana

Zabbix datasource, Triggers panel and more.

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/alexanderzobnin/grafana-zabbix?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

<img width="640" alt="Dashboard" src="https://cloud.githubusercontent.com/assets/4932851/16547269/69d67380-4170-11e6-9724-ac8b53cd8b93.png">

## Features
  - Flexible metric editor with Regex support
  - Template variables support
  - Annotations support (show events on graph)
  - Triggers panel
  - Client-side metrics processing (Avg, Median, Min, Max, Multiply, Summarize)

See features overview and dashboards examples at Grafana-Zabbix [Live demo](http://play.grafana-zabbix.org) site.
Visit [Zabbix plugin page](http://grafana.net/plugins/alexanderzobnin-zabbix-app) at [grafana.net](http://grafana.net) and check out list of available Grafana data sources, panels and dashboards.

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

## Dockerized Grafana with Zabbix datasource

```sh
# create /var/lib/grafana as persistent volume storage
docker run -d -v /var/lib/grafana --name grafana-xxl-storage busybox:latest

# start grafana-xxl
docker run \
  -d \
  -p 3000:3000 \
  --name grafana-xxl \
  --volumes-from grafana-xxl-storage \
  monitoringartist/grafana-xxl
```

Visit [Grafana XXL project](https://github.com/monitoringartist/grafana-xxl) for more details.

---
:copyright: 2015-2016 Alexander Zobnin alexanderzobnin@gmail.com

Licensed under the Apache 2.0 License
