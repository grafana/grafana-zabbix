import {ZabbixAPIDatasource} from './datasource';
import {ZabbixQueryController} from './query.controller';
import {ZabbixDSConfigController} from './config.controller';

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
