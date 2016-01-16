/**
 * Grafana-Zabbix
 * Zabbix plugin for Grafana.
 * http://github.com/alexanderzobnin/grafana-zabbix
 *
 * Trigger panel.
 * This feature sponsored by CORE IT
 * http://www.coreit.fr
 *
 * Copyright 2015 Alexander Zobnin alexanderzobnin@gmail.com
 * Licensed under the Apache License, Version 2.0
 */

define([
  'angular',
  'app/app',
  'lodash',
  'jquery',
  'app/core/config',
  'app/features/panel/panel_meta',
  '../zabbix/helperFunctions',
],
function (angular, app, _, $, config, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.triggers', []);
  app.useModule(module);

  /** @ngInject */
  function TriggerPanelCtrl($q, $scope, $element, datasourceSrv, panelSrv, templateSrv, zabbixHelperSrv, popoverSrv) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Zabbix triggers',
      editIcon:  "fa fa-lightbulb-o",
      fullscreen: true,
    });

    $scope.panelMeta.addEditorTab('Options', 'public/plugins/triggers/editor.html');

    $scope.ackFilters = [
      'all triggers',
      'unacknowledged',
      'acknowledged'
    ];

    $scope.sortByFields = [
      { text: 'last change',  value: 'lastchange' },
      { text: 'severity',     value: 'priority' }
    ];

    var grafanaDefaultSeverity = [
      { priority: 0, severity: 'Not classified',  color: '#B7DBAB', show: true },
      { priority: 1, severity: 'Information',     color: '#82B5D8', show: true },
      { priority: 2, severity: 'Warning',         color: '#E5AC0E', show: true },
      { priority: 3, severity: 'Average',         color: '#C15C17', show: true },
      { priority: 4, severity: 'High',            color: '#BF1B00', show: true },
      { priority: 5, severity: 'Disaster',        color: '#890F02', show: true }
    ];

    var panelDefaults = {
      datasource: null,
      triggers: {
        group: {name: 'All', groupid: null},
        host: {name: 'All', hostid: null},
        application: {name: 'All', value: null}
      },
      hostField: true,
      severityField: false,
      lastChangeField: true,
      ageField: true,
      infoField: true,
      limit: 10,
      showTriggers: 'all triggers',
      sortTriggersBy: { text: 'last change', value: 'lastchange' },
      triggerSeverity: grafanaDefaultSeverity
    };

    _.defaults($scope.panel, panelDefaults);
    $scope.triggerList = [];

    $scope.init = function() {
      panelSrv.init($scope);
      if ($scope.isNewPanel()) {
        $scope.panel.title = "Zabbix Triggers";
      }

      if (!$scope.metric) {
        $scope.metric = {
          groupList: [{name: 'All', groupid: null}],
          hostList: [{name: 'All', hostid: null}],
          applicationList: [{name: 'All', applicationid: null}]
        };
      }

      // Get zabbix data sources
      var datasources = _.filter(datasourceSrv.getMetricSources(), function(datasource) {
        return datasource.meta.id === 'zabbix';
      });
      $scope.datasources = _.map(datasources, 'name');

      // Set default datasource
      if (!$scope.panel.datasource) {
        $scope.panel.datasource = $scope.datasources[0];
      }

      // Update lists of groups, hosts and applications
      $scope.updateGroups()
        .then($scope.updateHosts)
        .then($scope.updateApplications);
    };

    $scope.refreshData = function() {

      // Load datasource
      return datasourceSrv.get($scope.panel.datasource).then(function (datasource) {
        var zabbix = datasource.zabbixAPI;

        var groupid = $scope.panel.triggers.group.groupid;
        var hostid = $scope.panel.triggers.host.hostid;
        var applicationids = $scope.panel.triggers.application.value;

        // Get triggers
        return zabbix.getTriggers(null,
                                  $scope.panel.sortTriggersBy.value,
                                  groupid,
                                  hostid,
                                  applicationids,
                                  $scope.panel.triggers.name)
          .then(function(triggers) {
            var promises = _.map(triggers, function (trigger) {
              var lastchange = new Date(trigger.lastchange * 1000);
              var lastchangeUnix = trigger.lastchange;
              var now = new Date();

              // Consider local time offset
              var ageUnix = now - lastchange + now.getTimezoneOffset() * 60000;
              var age = zabbixHelperSrv.toZabbixAgeFormat(ageUnix);
              var triggerObj = trigger;
              triggerObj.lastchangeUnix = lastchangeUnix;
              triggerObj.lastchange = lastchange.toLocaleString();
              triggerObj.age = age.toLocaleString();
              triggerObj.color = $scope.panel.triggerSeverity[trigger.priority].color;
              triggerObj.severity = $scope.panel.triggerSeverity[trigger.priority].severity;

              // Request acknowledges for trigger
              return zabbix.getAcknowledges(trigger.triggerid, lastchangeUnix)
                .then(function (acknowledges) {
                  if (acknowledges.length) {
                    triggerObj.acknowledges = _.map(acknowledges, function (ack) {
                      var time = new Date(+ack.clock * 1000);
                      ack.time = time.toLocaleString();
                      ack.user = ack.alias + ' (' + ack.name + ' ' + ack.surname + ')';
                      return ack;
                    });
                  }
                  return triggerObj;
                });
            });
            return $q.all(promises).then(function (triggerList) {

              // Filter acknowledged triggers
              if ($scope.panel.showTriggers === 'unacknowledged') {
                $scope.triggerList = _.filter(triggerList, function (trigger) {
                  return !trigger.acknowledges;
                });
              } else if ($scope.panel.showTriggers === 'acknowledged') {
                $scope.triggerList = _.filter(triggerList, 'acknowledges');
              } else {
                $scope.triggerList = triggerList;
              }

              // Filter triggers by severity
              $scope.triggerList = _.filter($scope.triggerList, function (trigger) {
                return $scope.panel.triggerSeverity[trigger.priority].show;
              });

              // Limit triggers number
              $scope.triggerList  = _.first($scope.triggerList, $scope.panel.limit);

              $scope.panelRenderingComplete();
            });
          });
      });
    };

    $scope.groupChanged = function() {
      return $scope.updateHosts()
        .then($scope.updateApplications)
        .then($scope.refreshData);
    };

    $scope.hostChanged = function() {
      return $scope.updateApplications()
        .then($scope.refreshData);
    };

    $scope.appChanged = function() {
      var app = $scope.panel.triggers.application.name;

      return datasourceSrv.get($scope.panel.datasource).then(function (datasource) {
        return datasource.zabbixAPI.getAppByName(app).then(function (applications) {
          var appids = _.map(applications, 'applicationid');
          $scope.panel.triggers.application.value = appids.length ? appids : null;
        });
      }).then($scope.refreshData);
    };

    $scope.updateGroups = function() {
      return datasourceSrv.get($scope.panel.datasource).then(function (datasource) {
        return $scope.updateGroupList(datasource);
      });
    };

    $scope.updateHosts = function() {
      return datasourceSrv.get($scope.panel.datasource).then(function (datasource) {
        return $scope.updateHostList(datasource);
      });
    };

    $scope.updateApplications = function() {
      return datasourceSrv.get($scope.panel.datasource).then(function (datasource) {
        return $scope.updateAppList(datasource);
      });
    };

    $scope.refreshTriggerSeverity = function() {
      _.each($scope.triggerList, function(trigger) {
        trigger.color = $scope.panel.triggerSeverity[trigger.priority].color;
        trigger.severity = $scope.panel.triggerSeverity[trigger.priority].severity;
      });
    };

    $scope.datasourceChanged = function() {
      $scope.refreshData();
    };

    $scope.changeTriggerSeverityColor = function(trigger, color) {
      $scope.panel.triggerSeverity[trigger.priority].color = color;
      $scope.refreshTriggerSeverity();
    };

    function getTriggerIndexForElement(el) {
      return el.parents('[data-trigger-index]').data('trigger-index');
    }

    $scope.openTriggerColorSelector = function(event) {
      var el = $(event.currentTarget);
      var index = getTriggerIndexForElement(el);
      var popoverScope = $scope.$new();
      popoverScope.trigger = $scope.panel.triggerSeverity[index];
      popoverScope.changeTriggerSeverityColor = $scope.changeTriggerSeverityColor;

      popoverSrv.show({
        element: el,
        placement: 'top',
        templateUrl:  'public/plugins/triggers/trigger.colorpicker.html',
        scope: popoverScope
      });
    };

    $scope.updateGroupList = function (datasource) {
      datasource.zabbixAPI.performHostGroupSuggestQuery().then(function (groups) {
        $scope.metric.groupList = $scope.metric.groupList.concat(groups);
      });
    };

    $scope.updateHostList = function (datasource) {
      var groups = $scope.panel.triggers.group.groupid ? $scope.panel.triggers.group.name : '*';
      if (groups) {
        datasource.zabbixAPI.hostFindQuery(groups).then(function (hosts) {
          $scope.metric.hostList = [{name: 'All', hostid: null}];
          $scope.metric.hostList = $scope.metric.hostList.concat(hosts);
        });
      }
    };

    $scope.updateAppList = function (datasource) {
      var groups = $scope.panel.triggers.group.groupid ? $scope.panel.triggers.group.name : '*';
      var hosts = $scope.panel.triggers.host.hostid ? $scope.panel.triggers.host.name : '*';
      if (groups && hosts) {
        datasource.zabbixAPI.appFindQuery(hosts, groups).then(function (apps) {
          apps = _.map(_.uniq(_.map(apps, 'name')), function (appname) {
            return {
              name: appname,
              value: appname
            };
          });
          $scope.metric.applicationList = [{name: 'All', value: null}];
          $scope.metric.applicationList = $scope.metric.applicationList.concat(apps);
        });
      }
    };

    $scope.init();
  }

  function triggerPanelDirective() {
    return {
      controller: TriggerPanelCtrl,
      templateUrl: 'public/plugins/triggers/module.html',
    };
  }

  return {
    panel: triggerPanelDirective
  };

});
