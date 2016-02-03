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
  'moment',
  'app/core/config',
  'app/features/panel/panel_meta'
],
function (angular, app, _, $, moment, config, PanelMeta) {
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
      triggerSeverity: grafanaDefaultSeverity,
      okEventColor: '#890F02'
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
        var queryProcessor = datasource.queryProcessor;
        var triggerFilter = $scope.panel.triggers;
        var showEvents = $scope.panel.showEvents.value;
        var buildQuery = queryProcessor.buildTriggerQuery(triggerFilter.group.filter,
                                                          triggerFilter.host.filter,
                                                          triggerFilter.application.filter);
        return buildQuery.then(function(query) {
          return zabbix.getTriggers(query.groupids,
                                    query.hostids,
                                    query.applicationids,
                                    showEvents)
            .then(function(triggers) {
              return _.map(triggers, function (trigger) {
                var triggerObj = trigger;

                // Format last change and age
                trigger.lastchangeUnix = Number(trigger.lastchange);
                var timestamp = moment.unix(trigger.lastchangeUnix);
                triggerObj.lastchange = timestamp.format("DD MMM YYYY, HH:mm:ss");
                triggerObj.age = timestamp.fromNow(true);

                // Set color
                if (trigger.value === '1') {
                  triggerObj.color = $scope.panel.triggerSeverity[trigger.priority].color;
                } else {
                  triggerObj.color = $scope.panel.okEventColor;
                }

                triggerObj.severity = $scope.panel.triggerSeverity[trigger.priority].severity;
                return triggerObj;
              });
            })
            .then(function (triggerList) {

              // Request acknowledges for trigger
              var eventids = _.map(triggerList, function(trigger) {
                return trigger.lastEvent.eventid;
              });
              return zabbix.getAcknowledges(eventids)
                .then(function (events) {

                  // Map events to triggers
                  _.each(triggerList, function(trigger) {
                    var event = _.find(events, function(event) {
                      return event.eventid === trigger.lastEvent.eventid;
                    });

                    if (event) {
                      trigger.acknowledges = _.map(event.acknowledges, function (ack) {
                        var time = new Date(+ack.clock * 1000);
                        ack.time = time.toLocaleString();
                        ack.user = ack.alias + ' (' + ack.name + ' ' + ack.surname + ')';
                        return ack;
                      });
                    }
                  });

                  // Filter triggers by description
                  var triggerFilter = $scope.panel.triggers.trigger.filter;
                  if (triggerFilter) {
                    triggerList = filterTriggers(triggerList, triggerFilter);
                  }

                  // Filter acknowledged triggers
                  if ($scope.panel.showTriggers === 'unacknowledged') {
                    triggerList = _.filter(triggerList, function (trigger) {
                      return !trigger.acknowledges;
                    });
                  } else if ($scope.panel.showTriggers === 'acknowledged') {
                    triggerList = _.filter(triggerList, 'acknowledges');
                  } else {
                    triggerList = triggerList;
                  }

                  // Filter triggers by severity
                  triggerList = _.filter(triggerList, function (trigger) {
                    return $scope.panel.triggerSeverity[trigger.priority].show;
                  });

                  // Sort triggers
                  if ($scope.panel.sortTriggersBy.value === 'priority') {
                    triggerList = _.sortBy(triggerList, 'priority').reverse();
                  } else {
                    triggerList = _.sortBy(triggerList, 'lastchangeUnix').reverse();
                  }

                  // Limit triggers number
                  $scope.triggerList  = _.first(triggerList, $scope.panel.limit);

                  $scope.panelRenderingComplete();
                });
            });
        });
      });
    };

    $scope.initFilters = function () {
      $scope.filterGroups();
      $scope.filterHosts();
      $scope.filterApplications();
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

    $scope.filterHosts = function() {
      var groupFilter = templateSrv.replace($scope.panel.triggers.group.filter);
      $scope.datasource.queryProcessor.filterHosts(groupFilter).then(function(hosts) {
        $scope.metric.filteredHosts = hosts;
      });
    };

    $scope.filterApplications = function() {
      var groupFilter = templateSrv.replace($scope.panel.triggers.group.filter);
      var hostFilter = templateSrv.replace($scope.panel.triggers.host.filter);
      $scope.datasource.queryProcessor.filterApplications(groupFilter, hostFilter)
        .then(function(apps) {
          $scope.metric.filteredApplications = apps;
        });
    };

    function filterTriggers(triggers, triggerFilter) {
      if (isRegex(triggerFilter)) {
        return _.filter(triggers, function(trigger) {
          return buildRegex(triggerFilter).test(trigger.description);
        });
      } else {
        return _.filter(triggers, function(trigger) {
          return trigger.description === triggerFilter;
        });
      }
    }

    $scope.onTargetPartChange = function(targetPart) {
      var regexStyle = {'color': '#CCA300'};
      targetPart.isRegex = isRegex(targetPart.filter);
      targetPart.style = targetPart.isRegex ? regexStyle : {};
    };

    function isRegex(str) {
      // Pattern for testing regex
      var regexPattern = /^\/(.*)\/([gmi]*)$/m;
      return regexPattern.test(str);
    }

    function buildRegex(str) {
      var regexPattern = /^\/(.*)\/([gmi]*)$/m;
      var matches = str.match(regexPattern);
      var pattern = matches[1];
      var flags = matches[2] !== "" ? matches[2] : undefined;
      return new RegExp(pattern, flags);
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

    $scope.openOkEventColorSelector = function(event) {
      var el = $(event.currentTarget);
      var popoverScope = $scope.$new();
      popoverScope.trigger = {color: $scope.panel.okEventColor};
      popoverScope.changeTriggerSeverityColor = function(trigger, color) {
        $scope.panel.okEventColor = color;
        $scope.refreshTriggerSeverity();
      };

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
