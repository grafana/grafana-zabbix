define([
  './datasource'
],
function (ZabbixAPIDatasource) {
  'use strict';

  function ZabbixQueryCtrl() {
    return {controller: 'ZabbixAPIQueryCtrl', templateUrl: 'public/plugins/zabbix/partials/query.editor.html'};
  }

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
    ConfigCtrl: ZabbixConfigCtrl,
    QueryCtrl: ZabbixQueryCtrl,
    QueryOptionsCtrl: ZabbixQueryOptionsCtrl,
    AnnotationsQueryCtrl: ZabbixAnnotationsQueryCtrl
  };
});
