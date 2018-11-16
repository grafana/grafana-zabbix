import { loadPluginCss } from 'grafana/app/plugins/sdk';
import { ZabbixDatasource } from './datasource';
import { ZabbixQueryController } from './query.controller';
import { ZabbixDSConfigController } from './config.controller';
import './zabbixAlerting.service.js';
import './add-metric-function.directive';
import './metric-function-editor.directive';

class ZabbixQueryOptionsController {}
ZabbixQueryOptionsController.templateUrl = 'datasource-zabbix/partials/query.options.html';

class ZabbixAnnotationsQueryController {}
ZabbixAnnotationsQueryController.templateUrl = 'datasource-zabbix/partials/annotations.editor.html';

ZabbixQueryController.templateUrl = 'datasource-zabbix/partials/query.editor.html';
ZabbixDSConfigController.templateUrl = 'datasource-zabbix/partials/config.html';

loadPluginCss({
  dark: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.dark.css',
  light: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.light.css'
});

export {
  ZabbixDatasource as Datasource,
  ZabbixDSConfigController as ConfigCtrl,
  ZabbixQueryController as QueryCtrl,
  ZabbixQueryOptionsController as QueryOptionsCtrl,
  ZabbixAnnotationsQueryController as AnnotationsQueryCtrl
};
