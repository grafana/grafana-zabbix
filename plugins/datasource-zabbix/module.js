define([
  './datasource',
  './queryCtrl'
],
function (ZabbixAPIDatasource, ZabbixQueryCtrl) {
  'use strict';

  function ZabbixQueryOptionsCtrl() {
    return {templateUrl: 'public/plugins/zabbix/partials/query.options.html'};
  }

  function ZabbixAnnotationsQueryCtrl() {
    return {templateUrl: 'public/plugins/zabbix/partials/annotations.editor.html'};
  }

  function ZabbixConfigCtrl() {
    return {templateUrl: 'public/plugins/zabbix/partials/config.html'};
  }

  return {
    Datasource: ZabbixAPIDatasource,
    QueryCtrl: ZabbixQueryCtrl,
    ConfigCtrl: ZabbixConfigCtrl,
    QueryOptionsCtrl: ZabbixQueryOptionsCtrl,
    AnnotationsQueryCtrl: ZabbixAnnotationsQueryCtrl
  };
});
