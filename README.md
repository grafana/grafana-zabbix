# Zabbix plugin for Grafana

Zabbix datasource, Triggers panel and more.

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/alexanderzobnin/grafana-zabbix?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

## Features
  - Flexible metric editor with Regex support
  - Template variables support

#### Templated dashboards support
Group, host, application or item names can be replaced with a template variable. This allows you to create generic dashboards that can quickly be changed to show stats for a specific cluster, server or application.


#### Annotations support
 * Display zabbix events on graphs
 * Show acknowledges for problems


See features overview and dashboards examples at Grafana-Zabbix [Live demo](http://play.grafana-zabbix.org) site.
Visit [Zabbix plugin page](http://grafana.net/plugins/alexanderzobnin-zabbix-app) at [grafana.net](http://grafana.net) and check out list of available Grafana data sources, panels and dashboards.

## Installation
Install by using `grafana-cli`
```sh
grafana-cli plugins install alexanderzobnin-zabbix-app
```
Or see more installation options in [docs](http://docs.grafana-zabbix.org/installation/)

## Documentation
  - [About](http://docs.grafana-zabbix.org)
  - [Installation](http://docs.grafana-zabbix.org/installation)
  - [Getting Started](http://docs.grafana-zabbix.org/guides/gettingstarted)


### Meet grafana-zabbix 3.0
Download [grafana-zabbix 3.0 beta](https://github.com/alexanderzobnin/grafana-zabbix/releases/latest)

[Documentation](http://docs.grafana-zabbix.org)
Read [installation instruction](http://docs.grafana-zabbix.org/installation/) for version 3.0.

Display your Zabbix data with powerful [Grafana](http://grafana.org) dashboards!

![Dashboard](https://cloud.githubusercontent.com/assets/4932851/8269101/9e6ee67e-17a3-11e5-85de-fe9dcc2dd375.png)

### Dockerized Grafana with Zabbix datasource

    # create /var/lib/grafana as persistent volume storage
    docker run -d -v /var/lib/grafana --name grafana-xxl-storage busybox:latest

    # start grafana-xxl
    docker run \
      -d \
      -p 3000:3000 \
      --name grafana-xxl \
      --volumes-from grafana-xxl-storage \
      monitoringartist/grafana-xxl

Visit [Grafana XXL project](https://github.com/monitoringartist/grafana-xxl) for more details.

Read more about Grafana features at [grafana.org](http://grafana.org)
