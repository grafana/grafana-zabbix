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

**WARNING!** The only reliable installation method is `grafana-cli`. Any other ways should be treated as a workaround an don't provide any backward-compatibulity guaranties.

## From github repo
**WARNING!** This way doesn't work anymore (`dist/` folder was removed from git). Use `grafana-cli` or build plugin from sources.

## Building from sources

If you want to build a package yourself, or contribute - read [building instructions](./run_from_master).
