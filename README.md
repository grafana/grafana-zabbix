# grafana-zabbix
## Zabbix API datasource for Grafana dashboard

Display your Zabbix data directly in Grafana dashboards!   

![alt tag](https://cloud.githubusercontent.com/assets/4932851/7454206/34bf9f8c-f27a-11e4-8e96-a73829f188c4.png)

Useful metric editor with host group and application filtering:

![alt tag](https://cloud.githubusercontent.com/assets/4932851/7441162/4f6af788-f0e4-11e4-887b-34d987d00c40.png)


## Installation

### Grafana 1.9.x

Download latest 1.x.x release and unpack into `<your grafana installation>/plugins/datasource/`. Then edit Grafana config.js:
  * Add dependencies
  
    ```
    plugins: {
      panels: [],
      dependencies: ['datasource/zabbix/datasource', 'datasource/zabbix/queryCtrl'],
    }
    ```
  * Add datasource and setup your Zabbix API url, username and password
  
    ```
    datasources: {
      ...
      },
      zabbix: {
        type: 'ZabbixAPIDatasource',
        url: 'http://www.zabbix.org/zabbix/api_jsonrpc.php',
        username: 'guest',
        password: ''
      }
    },
    ```
    
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
See [full listing](https://gist.github.com/alexanderzobnin/f2348f318d7a93466a0c).
