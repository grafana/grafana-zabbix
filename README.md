# grafana-zabbix

#### Zabbix API datasource for Grafana dashboard

Display your Zabbix data directly in Grafana dashboards!   
Useful metric editor with host group and application filtering:

![grafana - zabbix datasource](https://cloud.githubusercontent.com/assets/4932851/7441162/4f6af788-f0e4-11e4-887b-34d987d00c40.png)

## Installation

### Grafana 1.9.x

Download [latest release](https://github.com/alexanderzobnin/grafana-zabbix/releases) and unpack `zabbix` directory into `<your grafana installation>/plugins/datasource/`. Then edit Grafana config.js:
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
