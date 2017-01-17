import {ZabbixAPIDatasource} from './datasource';
import {ZabbixQueryController} from './query.controller';

class ZabbixConfigController {}
ZabbixConfigController.templateUrl = 'datasource-zabbix/partials/config.html';

class ZabbixQueryOptionsController {}
ZabbixQueryOptionsController.templateUrl = 'datasource-zabbix/partials/query.options.html';

class ZabbixAnnotationsQueryController {}
ZabbixAnnotationsQueryController.templateUrl = 'datasource-zabbix/partials/annotations.editor.html';

export {
  ZabbixAPIDatasource as Datasource,
  ZabbixConfigController as ConfigCtrl,
  ZabbixQueryController as QueryCtrl,
  ZabbixQueryOptionsController as QueryOptionsCtrl,
  ZabbixAnnotationsQueryController as AnnotationsQueryCtrl
};
