page_title: Grafana-Zabbix Installation
page_description: Installation instructions for Grafana-Zabbix.

# Installation

## From release package
Download [latest release](https://github.com/alexanderzobnin/grafana-zabbix/releases/latest)
for relative Grafana version or just clone a repo:
```
git clone https://github.com/alexanderzobnin/grafana-zabbix.git
```

Copy content of `plugins` into your grafana plugins directory (default `/var/lib/grafana/plugins`
if your installing grafana with package).
Restart grafana-server and the plugin should be automatically detected and used.

## Building from sources
You need NodeJS, npm and Grunt for building plugin from sources. Read more about required versions
in [Grafana docs](http://docs.grafana.org/project/building_from_source/).

```sh
git clone https://github.com/alexanderzobnin/grafana-zabbix.git
cd grafana-zabbix
npm install
npm install -g grunt-cli
grunt
```

Plugin will built into *dist/* directory. Then you can copy it into your grafana plugins directory
or set path to compiled plugin in grafana config:

```ini
[plugin.zabbix]
path = /home/your/clone/dir/grafana-zabbix/dist
```

If you need to upgrade plugin use

```sh
git pull
grunt
```

Restart Grafana server

```sh
sudo service grafana-server restart
systemctl restart grafana-server
```

## Using grafana-cli tool

Get list of available plugins

```sh
grafana-cli plugins list-remote
```

Install zabbix plugin

```sh
grafana-cli plugins install zabbix-app
```

Read more in [Grafana docs](http://docs.grafana.org/plugins/installation/)
