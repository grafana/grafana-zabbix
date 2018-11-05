page_title: Grafana-Zabbix Installation
page_description: Installation instructions for Grafana-Zabbix.

# Installation

## Using grafana-cli tool
Get list of available plugins

```sh
grafana-cli plugins list-remote
```

Install zabbix plugin

```sh
grafana-cli plugins install alexanderzobnin-zabbix-app
```

Restart grafana after installing plugins
```sh
service grafana-server restart
```

Read more about installing plugins in [Grafana docs](http://docs.grafana.org/plugins/installation/)

## From github repo
**WARNING!** This way doesn't work anymore (`dist/` folder was removed from git). Use `grafana-cli` or build plugin from sources.

## Building from sources

If you want to build a package yourself, or contribute - read [building instructions](/installation/run_from_master).
