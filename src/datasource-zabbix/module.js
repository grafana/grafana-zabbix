import {loadPluginCss} from 'app/plugins/sdk';
import {ZabbixAPIDatasource} from './datasource';
import {ZabbixQueryController} from './query.controller';
import {ZabbixDSConfigController} from './config.controller';

loadPluginCss({
  dark: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.dark.css',
  light: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.light.css'
});

class ZabbixQueryOptionsController {}
ZabbixQueryOptionsController.templateUrl = 'datasource-zabbix/partials/query.options.html';

class ZabbixAnnotationsQueryController {}
ZabbixAnnotationsQueryController.templateUrl = 'datasource-zabbix/partials/annotations.editor.html';

export {
  ZabbixAPIDatasource as Datasource,
  ZabbixDSConfigController as ConfigCtrl,
  ZabbixQueryController as QueryCtrl,
  ZabbixQueryOptionsController as QueryOptionsCtrl,
  ZabbixAnnotationsQueryController as AnnotationsQueryCtrl
};
