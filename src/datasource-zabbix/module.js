import {ZabbixAPIDatasource} from './datasource';
import {ZabbixQueryController} from './query.controller';

class ZabbixConfigController {}
ZabbixConfigController.templateUrl = 'partials/config.html';

class ZabbixQueryOptionsController {}
ZabbixQueryOptionsController.templateUrl = 'partials/query.options.html';

class ZabbixAnnotationsQueryController {}
ZabbixAnnotationsQueryController.templateUrl = 'partials/annotations.editor.html';

export {
  ZabbixAPIDatasource as Datasource,
  ZabbixConfigController as ConfigCtrl,
  ZabbixQueryController as QueryCtrl,
  ZabbixQueryOptionsController as QueryOptionsCtrl,
  ZabbixAnnotationsQueryController as AnnotationsQueryCtrl
};
