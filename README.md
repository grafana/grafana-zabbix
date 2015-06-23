# Grafana-Zabbix

## Zabbix datasource for Grafana dashboard

[![Donate](https://cloud.githubusercontent.com/assets/4932851/8266321/38511d84-1731-11e5-826b-7f29bbebfbd8.png)](https://money.yandex.ru/embed/shop.xml?account=41001684402290&quickpay=shop&payment-type-choice=on&writer=seller&targets=Grafana-Zabbix&targets-hint=&default-sum=100&button-text=04&comment=on&hint=Your+suggestions&mail=on&successURL=)

Display your Zabbix data directly in [Grafana](http://grafana.org) dashboards!

![Dashboard](https://cloud.githubusercontent.com/assets/4932851/8269101/9e6ee67e-17a3-11e5-85de-fe9dcc2dd375.png)

#### Content
- [**Features**](#features)  
- [**Installation**](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Installation)  
- [**Troubleshooting**](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Troubleshooting)  
- [**User's Guide**](https://github.com/alexanderzobnin/grafana-zabbix/wiki/Usage)  
Read more in [wiki](https://github.com/alexanderzobnin/grafana-zabbix/wiki).

## Features

#### Flexible metric editor
 * hosts and items filtering:
 
![Query editor](https://cloud.githubusercontent.com/assets/4932851/8269157/9509dd66-17a6-11e5-8547-95adc2298942.png)

 * Custom scale for each target:

![Scale](https://cloud.githubusercontent.com/assets/4932851/8269207/212549be-17a9-11e5-9e33-90deb90ddc13.png)

#### Templated dashboards support
Group, host, application or item names can be replaced with a template variable. This allows you to create generic dashboards that can quickly be changed to show stats for a specific cluster, server or application.

#### Annotations support
 * Display zabbix events on graphs:
![Annotations](https://cloud.githubusercontent.com/assets/4932851/8269358/622ec3be-17ad-11e5-8023-eba137369cfe.png)
 * Show acknowledges for problems:  
![Acknowledges](https://cloud.githubusercontent.com/assets/4932851/8269375/e6d8706a-17ad-11e5-8e2d-2d707d8ee67f.png)

Read more about Grafana features at [grafana.org](http://grafana.org)


## Installation

### Grafana 1.9.x
See [grafana-1.9](../../tree/grafana-1.9) branch or Grafana-Zabbix [wiki](https://github.com/alexanderzobnin/grafana-zabbix/wiki).

### Grafana 2.0.x
Download source code from master branch and put `zabbix` directory into `<your grafana-2 installation>/public/app/plugins/datasource/`.
  * Edit plugin.json (located in `zabbix` directory) and set your `username` and `password`
  
    ```
    {
      "pluginType": "datasource",
      "name": "Zabbix",

      "type": "zabbix",
      "serviceName": "ZabbixAPIDatasource",

      "module": "plugins/datasource/zabbix/datasource",

      "partials": {
        "config": "app/plugins/datasource/zabbix/partials/config.html",
        "query": "app/plugins/datasource/zabbix/partials/query.editor.html",
        "annotations": "app/plugins/datasource/zabbix/partials/annotations.editor.html"
      },

      "username": "guest",
      "password": "",

      "metrics": true,
      "annotations": true
    }

    ```
  * Restart grafana server.
  * Add zabbix datasource in Grafana's "Data Sources" menu (see [Data Sources docs](http://docs.grafana.org/datasources/graphite/) for more info) and setup your Zabbix API url.
  * **Important!** Change `Access` to `direct`!
    ![2015-05-18 12-46-03 grafana - zabbix org - mozilla firefox](https://cloud.githubusercontent.com/assets/4932851/7678429/b42a9cda-fd5c-11e4-84a3-07aa765769d3.png)

#### Trends support
If you use patch for trends support ([ZBXNEXT-1193](https://support.zabbix.com/browse/ZBXNEXT-1193)), you don't need to do anything - trends support is enabled by default in `plugin.json` file:

```
  "trends": true,
  "trendsFrom": "7d",
```

`trendsFrom` option define period when switch to trends from history. You can set the time in Grafana format: `7d` for 7 days or for example `2d` for 2 days. Valid time specificators are:  
`h` - hours  
`d` - days  
`M` - months

If you don't use trend patch, change `trends` to `false`:
```
  "trends": false,
```

#### Note for Zabbix 2.2 or less
Zabbix API (api_jsonrpc.php) before zabbix 2.4 don't allow cross-domain requests (CORS). And you can get HTTP error 412 (Precondition Failed).
To fix it add this code to api_jsonrpc.php immediately after the copyright
```
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Max-Age: 1000');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
	return;
}
```
before 
```
require_once dirname(__FILE__).'/include/func.inc.php';
require_once dirname(__FILE__).'/include/classes/core/CHttpRequest.php';
```
[Full fix listing](https://gist.github.com/alexanderzobnin/f2348f318d7a93466a0c).
For more info see zabbix issues [ZBXNEXT-1377](https://support.zabbix.com/browse/ZBXNEXT-1377) and [ZBX-8459](https://support.zabbix.com/browse/ZBX-8459).

#### Note about browser cache
After updating plugin, clear browser cache and reload application page. See details for [Chrome](https://support.google.com/chrome/answer/95582), [Firefox](https://support.mozilla.org/en-US/kb/how-clear-firefox-cache). You need to clear cache only, not cookies, history and other data.

## Troubleshooting
See [Grafana troubleshooting](http://docs.grafana.org/installation/troubleshooting/) for general connection issues. If you have a problem with Zabbix datasource, you should open a [support issue](https://github.com/alexanderzobnin/grafana-zabbix/issues). Before you do that please search the existing closed or open issues.
