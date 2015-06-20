# Grafana-Zabbix

## Zabbix API datasource for Grafana dashboard

[![Donate](https://cloud.githubusercontent.com/assets/4932851/8266321/38511d84-1731-11e5-826b-7f29bbebfbd8.png)](https://money.yandex.ru/embed/shop.xml?account=41001684402290&quickpay=shop&payment-type-choice=on&writer=seller&targets=Grafana-Zabbix&targets-hint=&default-sum=100&button-text=04&comment=on&hint=Your+suggestions&mail=on&successURL=)

Read more in Grafana-Zabbix [wiki](https://github.com/alexanderzobnin/grafana-zabbix/wiki).

Display your Zabbix data directly in [Grafana](http://grafana.org) dashboards!

![Dashboard](https://cloud.githubusercontent.com/assets/4932851/8267599/857563e6-1771-11e5-83da-6b18b54f624c.png)

Useful metric editor with host group and application filtering:

![Query editor](https://cloud.githubusercontent.com/assets/4932851/7902360/156a9366-07c0-11e5-905b-4c21b52f1f44.png)


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
`M` - mounths

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
