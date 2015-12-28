define([
    'angular'
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('metricQueryEditorZabbix', function() {
      return {controller: 'ZabbixAPIQueryCtrl', templateUrl: 'public/plugins/zabbix/partials/query.editor.html'};
    });

    module.directive('metricQueryOptionsZabbix', function() {
      return {templateUrl: 'public/plugins/zabbix/partials/query.options.html'};
    });

    module.directive('annotationsQueryEditorZabbix', function() {
      return {templateUrl: 'public/plugins/zabbix/partials/annotations.editor.html'};
    });

  });
