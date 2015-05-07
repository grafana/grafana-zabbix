# grafana-zabbix
Zabbix API datasource for Grafana dashboard

## Installation

### Grafana 1.9.x

Download latest release and unpack into `<your grafana installation>/plugins/datasource/`. Then edit Grafana config.js:
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
Now in development.