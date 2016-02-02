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
  'app/features/panel/panel_meta'
],
function (angular, app, _, $, config, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.triggers', []);
  app.useModule(module);

  /** @ngInject */
  function TriggerPanelCtrl($q, $scope, $element, datasourceSrv, panelSrv, templateSrv, popoverSrv) {

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

    $scope.showEventsFields = [
      { text: 'all events',     value: [0,1] },
      { text: 'Ok events',      value: 0 },
      { text: 'Problem events', value: 1 }
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
        group: {filter: ""},
        host: {filter: ""},
        application: {filter: ""},
        trigger: {filter: ""}
      },
      hostField: true,
      severityField: false,
      lastChangeField: true,
      ageField: true,
      infoField: true,
      limit: 10,
      showTriggers: 'all triggers',
      sortTriggersBy: { text: 'last change', value: 'lastchange' },
      showEvents: { text: 'Problem events', value: '1' },
      triggerSeverity: grafanaDefaultSeverity
    };

    _.defaults($scope.panel, panelDefaults);
    $scope.triggerList = [];

    $scope.init = function() {
      panelSrv.init($scope);
      if ($scope.isNewPanel()) {
        $scope.panel.title = "Zabbix Triggers";
      }

      // Load scope defaults
      var scopeDefaults = {
        metric: {},
        inputStyles: {},
        oldTarget: _.cloneDeep($scope.panel.triggers)
      };
      _.defaults($scope, scopeDefaults);

      // Get zabbix data sources
      var datasources = _.filter(datasourceSrv.getMetricSources(), function(datasource) {
        return datasource.meta.id === 'zabbix';
      });
      $scope.datasources = _.map(datasources, 'name');

      // Set default datasource
      if (!$scope.panel.datasource) {
        $scope.panel.datasource = $scope.datasources[0];
      }
      // Load datasource
      datasourceSrv.get($scope.panel.datasource).then(function (datasource) {
        $scope.datasource = datasource;
        $scope.initFilters();
      });
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
                                  $scope.panel.triggers.name,
                                  $scope.panel.showEvents.value)
          .then(function(triggers) {
            var promises = _.map(triggers, function (trigger) {
              var lastchange = new Date(trigger.lastchange * 1000);
              var lastchangeUnix = trigger.lastchange;
              var now = new Date();

              // Consider local time offset
              var ageUnix = now - lastchange + now.getTimezoneOffset() * 60000;
              var age = toZabbixAgeFormat(ageUnix);
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

    $scope.initFilters = function () {
      $scope.filterGroups();
      $scope.filterHosts();
      $scope.filterApplications();
      //$scope.filterItems();
    };

    // Get list of metric names for bs-typeahead directive
    function getMetricNames(scope, metricList) {
      return _.uniq(_.map(scope.metric[metricList], 'name'));
    }

    // Map functions for bs-typeahead
    $scope.getGroupNames = _.partial(getMetricNames, $scope, 'groupList');
    $scope.getHostNames = _.partial(getMetricNames, $scope, 'filteredHosts');
    $scope.getApplicationNames = _.partial(getMetricNames, $scope, 'filteredApplications');
    $scope.getItemNames = _.partial(getMetricNames, $scope, 'filteredItems');

    $scope.filterGroups = function() {
      $scope.datasource.queryProcessor.filterGroups().then(function(groups) {
        $scope.metric.groupList = groups;
      });
    };

    $scope.filterHosts = function () {
      var groupFilter = templateSrv.replace($scope.panel.triggers.group.filter);
      $scope.datasource.queryProcessor.filterHosts(groupFilter).then(function(hosts) {
        $scope.metric.filteredHosts = hosts;
      });
    };

    $scope.filterApplications = function () {
      var groupFilter = templateSrv.replace($scope.panel.triggers.group.filter);
      var hostFilter = templateSrv.replace($scope.panel.triggers.host.filter);
      $scope.datasource.queryProcessor.filterApplications(groupFilter, hostFilter)
        .then(function(apps) {
          $scope.metric.filteredApplications = apps;
        });
    };

    $scope.onTargetPartChange = function (targetPart) {
      var regexStyle = {'color': '#CCA300'};
      targetPart.isRegex = isRegex(targetPart.filter);
      targetPart.style = targetPart.isRegex ? regexStyle : {};
    };

    function isRegex(str) {
      // Pattern for testing regex
      var regexPattern = /^\/(.*)\/([gmi]*)$/m;
      return regexPattern.test(str);
    }

    $scope.parseTarget = function() {
      $scope.initFilters();
      var newTarget = _.cloneDeep($scope.panel.triggers);
      if (!_.isEqual($scope.oldTarget, $scope.panel.triggers)) {
        $scope.oldTarget = newTarget;
        $scope.get_data();
      }
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

    /**
     * Convert event age from Unix format (milliseconds sins 1970)
     * to Zabbix format (like at Last 20 issues panel).
     * @param  {Date}           AgeUnix time in Unix format
     * @return {string}         Formatted time
     */
    function toZabbixAgeFormat(ageUnix) {
      var age = new Date(+ageUnix);
      var ageZabbix = age.getSeconds() + 's';
      if (age.getMinutes()) {
        ageZabbix = age.getMinutes() + 'm ' + ageZabbix;
      }
      if (age.getHours()) {
        ageZabbix = age.getHours() + 'h ' + ageZabbix;
      }
      if (age.getDate() - 1) {
        ageZabbix = age.getDate() - 1 + 'd ' + ageZabbix;
      }
      if (age.getMonth()) {
        ageZabbix = age.getMonth() + 'M ' + ageZabbix;
      }
      if (age.getYear() - 70) {
        ageZabbix = age.getYear() -70 + 'y ' + ageZabbix;
      }
      return ageZabbix;
    }

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
