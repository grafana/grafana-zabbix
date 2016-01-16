define([
  './datasource',
],
function (ZabbixAPIDatasource) {
  'use strict';

  function metricsQueryEditor() {
    return {controller: 'ZabbixAPIQueryCtrl', templateUrl: 'public/plugins/zabbix/partials/query.editor.html'};
  }

  function metricsQueryOptions() {
    return {templateUrl: 'public/plugins/zabbix/partials/query.options.html'};
  }

  function annotationsQueryEditor() {
    return {templateUrl: 'public/plugins/zabbix/partials/annotations.editor.html'};
  }

  function configView() {
    return {templateUrl: 'public/plugins/zabbix/partials/config.html'};
  }

  return {
    Datasource: ZabbixAPIDatasource,
    configView: configView,
    annotationsQueryEditor: annotationsQueryEditor,
    metricsQueryEditor: metricsQueryEditor,
    metricsQueryOptions: metricsQueryOptions,
  };
});
