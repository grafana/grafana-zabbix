import {ZabbixAPIDatasource} from './datasource';
import {ZabbixQueryCtrl} from './queryCtrl';

class ZabbixConfigCtrl {}
ZabbixConfigCtrl.templateUrl = 'partials/config.html';

class ZabbixQueryOptionsCtrl {}
ZabbixQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

class ZabbixAnnotationsQueryCtrl {}
ZabbixAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

export {
  ZabbixAPIDatasource as Datasource,
  ZabbixQueryCtrl as QueryCtrl,
  ZabbixConfigCtrl as ConfigCtrl,
  ZabbixQueryOptionsCtrl as QueryOptionsCtrl,
  ZabbixAnnotationsQueryCtrl as AnnotationsQueryCtrl
};
