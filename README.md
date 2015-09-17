# Grafana-Zabbix

[![Join the chat at https://gitter.im/alexanderzobnin/grafana-zabbix](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/alexanderzobnin/grafana-zabbix?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## Zabbix datasource for Grafana dashboard

##### See features overview and dashboards examples at Grafana-Zabbix [Live demo](http://play.grafana-zabbix.org) site.

##### Download [latest release](https://github.com/alexanderzobnin/grafana-zabbix/releases/latest)

Display your Zabbix data directly in [Grafana](http://grafana.org) dashboards!

![Dashboard](https://cloud.githubusercontent.com/assets/4932851/8269101/9e6ee67e-17a3-11e5-85de-fe9dcc2dd375.png)

#### [Documentation](https://github.com/alexanderzobnin/grafana-zabbix/wiki)
1. [**Overview**](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Overview)
2. [**Installation**](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Installation)
  - [Grafana 1.9.x](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Installation#grafana-19x)
  - [Grafana 2.x.x](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Installation#grafana-20x)
3. [**User’s Guide**](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Usage)
  - [Query editor](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Usage#query-editor)
    - [Filters](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Usage#filters)
    - [Scale](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Usage#scale)
  - [Templates](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Usage#templates)
    - [Templated variable editor](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Usage#templated-variable-editor)
    - [Creating templated dashboard](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Usage#creating-templated-dashboard)
  - [Annotations](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Usage#annotations)
4. [**Troubleshooting**](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Troubleshooting)

## Features

#### Flexible metric editor
 * hosts and items filtering:
 
[![regex_filter](https://cloud.githubusercontent.com/assets/4932851/8312766/5eb34480-19e7-11e5-925f-452a99ec0ab6.gif)](https://cloud.githubusercontent.com/assets/4932851/8312766/5eb34480-19e7-11e5-925f-452a99ec0ab6.gif)

 * Custom scale for each target:

![Scale](https://cloud.githubusercontent.com/assets/4932851/8269207/212549be-17a9-11e5-9e33-90deb90ddc13.png)

#### Templated dashboards support
Group, host, application or item names can be replaced with a template variable. This allows you to create generic dashboards that can quickly be changed to show stats for a specific cluster, server or application.

[![templated_dashboard](https://cloud.githubusercontent.com/assets/4932851/8312492/7f286c38-19e5-11e5-8c19-1b9e97292b06.gif)](https://cloud.githubusercontent.com/assets/4932851/8312492/7f286c38-19e5-11e5-8c19-1b9e97292b06.gif)

#### Annotations support
 * Display zabbix events on graphs:
![Annotations](https://cloud.githubusercontent.com/assets/4932851/8269358/622ec3be-17ad-11e5-8023-eba137369cfe.png)
 * Show acknowledges for problems:  
![Acknowledges](https://cloud.githubusercontent.com/assets/4932851/8269375/e6d8706a-17ad-11e5-8e2d-2d707d8ee67f.png)

Read more about Grafana features at [grafana.org](http://grafana.org)
