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
  'lodash',
  'jquery'
],
function (angular, _, $) {
  'use strict';

  function TriggerPanelEditorCtrl($scope, $q, uiSegmentSrv, datasourceSrv, templateSrv, popoverSrv) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;

    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;
    this.popoverSrv = popoverSrv;

    // Map functions for bs-typeahead
    this.getGroupNames = _.partial(getMetricNames, this, 'groupList');
    this.getHostNames = _.partial(getMetricNames, this, 'filteredHosts');
    this.getApplicationNames = _.partial(getMetricNames, this, 'filteredApplications');
    this.getItemNames = _.partial(getMetricNames, this, 'filteredItems');

    this.ackFilters = [
      'all triggers',
      'unacknowledged',
      'acknowledged'
    ];

    this.sortByFields = [
      { text: 'last change',  value: 'lastchange' },
      { text: 'severity',     value: 'priority' }
    ];

    this.showEventsFields = [
      { text: 'all events',     value: [0,1] },
      { text: 'Ok events',      value: 0 },
      { text: 'Problem events', value: 1 }
    ];

    // Load scope defaults
    var scopeDefaults = {
      metric: {},
      inputStyles: {},
      oldTarget: _.cloneDeep(this.panel.triggers),
      defaultTimeFormat: "DD MMM YYYY HH:mm:ss"
    };
    _.defaults(this, scopeDefaults);

    var self = this;

    // Get zabbix data sources
    var datasources = _.filter(this.datasourceSrv.getMetricSources(), function(datasource) {
      return datasource.meta.id === 'zabbix';
    });
    this.datasources = _.map(datasources, 'name');

    // Set default datasource
    if (!this.panel.datasource) {
      this.panel.datasource = this.datasources[0];
    }
    // Load datasource
    this.datasourceSrv.get(this.panel.datasource).then(function (datasource) {
      self.datasource = datasource;
      self.initFilters();
      self.panelCtrl.refreshData();
    });
  }

  var p = TriggerPanelEditorCtrl.prototype;

  // Get list of metric names for bs-typeahead directive
  function getMetricNames(scope, metricList) {
    return _.uniq(_.map(scope.metric[metricList], 'name'));
  }

  p.initFilters = function () {
    this.filterGroups();
    this.filterHosts();
    this.filterApplications();
  };

  p.filterGroups = function() {
    var self = this;
    this.datasource.queryProcessor.filterGroups().then(function(groups) {
      self.metric.groupList = groups;
    });
  };

  p.filterHosts = function() {
    var self = this;
    var groupFilter = this.templateSrv.replace(this.panel.triggers.group.filter);
    this.datasource.queryProcessor.filterHosts(groupFilter).then(function(hosts) {
      self.metric.filteredHosts = hosts;
    });
  };

  p.filterApplications = function() {
    var self = this;
    var groupFilter = this.templateSrv.replace(this.panel.triggers.group.filter);
    var hostFilter = this.templateSrv.replace(this.panel.triggers.host.filter);
    this.datasource.queryProcessor.filterApplications(groupFilter, hostFilter)
      .then(function(apps) {
        self.metric.filteredApplications = apps;
      });
  };

  p.onTargetPartChange = function(targetPart) {
    var regexStyle = {'color': '#CCA300'};
    targetPart.isRegex = isRegex(targetPart.filter);
    targetPart.style = targetPart.isRegex ? regexStyle : {};
  };

  function isRegex(str) {
    // Pattern for testing regex
    var regexPattern = /^\/(.*)\/([gmi]*)$/m;
    return regexPattern.test(str);
  }

  p.parseTarget = function() {
    this.initFilters();
    var newTarget = _.cloneDeep(this.panel.triggers);
    if (!_.isEqual(this.oldTarget, this.panel.triggers)) {
      this.oldTarget = newTarget;
      this.panelCtrl.refreshData();
    }
  };

  p.refreshTriggerSeverity = function() {
    _.each(this.triggerList, function(trigger) {
      trigger.color = this.panel.triggerSeverity[trigger.priority].color;
      trigger.severity = this.panel.triggerSeverity[trigger.priority].severity;
    });
    this.panelCtrl.refreshData();
  };

  p.datasourceChanged = function() {
    this.panelCtrl.refreshData();
  };

  p.changeTriggerSeverityColor = function(trigger, color) {
    this.panel.triggerSeverity[trigger.priority].color = color;
    this.refreshTriggerSeverity();
  };

  function getTriggerIndexForElement(el) {
    return el.parents('[data-trigger-index]').data('trigger-index');
  }

  p.openTriggerColorSelector = function(event) {
    var el = $(event.currentTarget);
    var index = getTriggerIndexForElement(el);
    var popoverScope = this.$new();
    popoverScope.trigger = this.panel.triggerSeverity[index];
    popoverScope.changeTriggerSeverityColor = this.changeTriggerSeverityColor;

    this.popoverSrv.show({
      element: el,
      placement: 'top',
      templateUrl:  'public/plugins/triggers/trigger.colorpicker.html',
      scope: popoverScope
    });
  };

  p.openOkEventColorSelector = function(event) {
    var el = $(event.currentTarget);
    var popoverScope = this.$new();
    popoverScope.trigger = {color: this.panel.okEventColor};
    popoverScope.changeTriggerSeverityColor = function(trigger, color) {
      this.panel.okEventColor = color;
      this.refreshTriggerSeverity();
    };

    this.popoverSrv.show({
      element: el,
      placement: 'top',
      templateUrl:  'public/plugins/triggers/trigger.colorpicker.html',
      scope: popoverScope
    });
  };

  var triggerPanelEditor = function() {
    return {
      restrict: 'E',
      scope: true,
      templateUrl: 'public/plugins/triggers/editor.html',
      controller: TriggerPanelEditorCtrl,
    };
  };

  return triggerPanelEditor;
});