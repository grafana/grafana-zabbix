define([
  './datasource',
  './queryCtrl'
],
function (ZabbixAPIDatasource, ZabbixQueryCtrl) {
  'use strict';

  function ZabbixQueryOptionsCtrl() {}
  ZabbixQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

  function ZabbixAnnotationsQueryCtrl() {}
  ZabbixAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

  function ZabbixConfigCtrl() {}
  ZabbixConfigCtrl.templateUrl = 'partials/config.html';

  return {
    Datasource: ZabbixAPIDatasource,
    QueryCtrl: ZabbixQueryCtrl,
    ConfigCtrl: ZabbixConfigCtrl,
    QueryOptionsCtrl: ZabbixQueryOptionsCtrl,
    AnnotationsQueryCtrl: ZabbixAnnotationsQueryCtrl
  };
});
