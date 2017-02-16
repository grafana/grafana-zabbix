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
Just clone plugin repo into your plugin directory
```sh
cd /var/lib/grafana/plugins
git clone https://github.com/alexanderzobnin/grafana-zabbix
```

Then restart grafana server.
```sh
service grafana-server restart
```

Using this way you can easy upgrade plugin just running
```sh
cd /var/lib/grafana/plugins/grafana-zabbix
git pull
service grafana-server restart
```

## From special repo
**WARNING!** This way is deprecated. Now main repo (https://github.com/alexanderzobnin/grafana-zabbix) contains builded plugin.  
You can use [grafana-zabbix-app](https://github.com/alexanderzobnin/grafana-zabbix-app) repo,
which contains latest builded version of plugin.

```sh
cd /var/lib/grafana/plugins
git clone https://github.com/alexanderzobnin/grafana-zabbix-app
```

Then restart grafana server.

Using this way you can easy upgrade plugin just running
```sh
cd /var/lib/grafana/plugins/grafana-zabbix-app
git pull
service grafana-server restart
```

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
service grafana-server restart
```
