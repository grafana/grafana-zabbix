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

import _ from 'lodash';
import * as utils from '../datasource-zabbix/utils';

import '../datasource-zabbix/css/query-editor.css!';

class TriggerPanelEditorCtrl {

  /** @ngInject */
  constructor($scope, $rootScope, $q, uiSegmentSrv, datasourceSrv, templateSrv, popoverSrv) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;

    this.$q = $q;
    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;
    this.popoverSrv = popoverSrv;

    // Map functions for bs-typeahead
    this.getGroupNames = _.partial(getMetricNames, this, 'groupList');
    this.getHostNames = _.partial(getMetricNames, this, 'hostList');
    this.getApplicationNames = _.partial(getMetricNames, this, 'appList');

    // Update metric suggestion when template variable was changed
    $rootScope.$on('template-variable-value-updated', () => this.onVariableChange());

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
      { text: 'All',     value: [0,1] },
      { text: 'OK',      value: [0] },
      { text: 'Problems', value: 1 }
    ];

    // Load scope defaults
    var scopeDefaults = {
      metric: {},
      inputStyles: {},
      oldTarget: _.cloneDeep(this.panel.triggers)
    };
    _.defaults(this, scopeDefaults);

    var self = this;

    // Get zabbix data sources
    var datasources = _.filter(this.datasourceSrv.getMetricSources(), datasource => {
      return datasource.meta.id === 'alexanderzobnin-zabbix-datasource';
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
      self.panelCtrl.refresh();
    });
  }

  initFilters() {
    var self = this;
    return this.$q
      .when(this.suggestGroups())
      .then(() => {return self.suggestHosts();})
      .then(() => {return self.suggestApps();});
  }

  suggestGroups() {
    var self = this;
    return this.datasource.zabbixCache
      .getGroups()
      .then(groups => {
        self.metric.groupList = groups;
        return groups;
      });
  }

  suggestHosts() {
    var self = this;
    var groupFilter = this.datasource.replaceTemplateVars(this.panel.triggers.group.filter);
    return this.datasource.queryProcessor
      .filterGroups(self.metric.groupList, groupFilter)
      .then(groups => {
        var groupids = _.map(groups, 'groupid');
        return self.datasource.zabbixAPI
          .getHosts(groupids)
          .then(hosts => {
            self.metric.hostList = hosts;
            return hosts;
          });
      });
  }

  suggestApps() {
    var self = this;
    var hostFilter = this.datasource.replaceTemplateVars(this.panel.triggers.host.filter);
    return this.datasource.queryProcessor
      .filterHosts(self.metric.hostList, hostFilter)
      .then(hosts => {
        var hostids = _.map(hosts, 'hostid');
        return self.datasource.zabbixAPI
          .getApps(hostids)
          .then(apps => {
            return self.metric.appList = apps;
          });
      });
  }

  onVariableChange() {
    if (this.isContainsVariables()) {
      this.targetChanged();
    }
  }

  /**
   * Check query for template variables
   */
  isContainsVariables() {
    var self = this;
    return _.some(self.templateSrv.variables, variable => {
      return _.some(['group', 'host', 'application'], field => {
        return self.templateSrv.containsVariable(self.panel.triggers[field].filter, variable.name);
      });
    });
  }

  targetChanged() {
    this.initFilters();
    this.panelCtrl.refresh();
  }

  parseTarget() {
    this.initFilters();
    var newTarget = _.cloneDeep(this.panel.triggers);
    if (!_.isEqual(this.oldTarget, this.panel.triggers)) {
      this.oldTarget = newTarget;
      this.panelCtrl.refresh();
    }
  }

  refreshTriggerSeverity() {
    _.each(this.triggerList, function(trigger) {
      trigger.color = this.panel.triggerSeverity[trigger.priority].color;
      trigger.severity = this.panel.triggerSeverity[trigger.priority].severity;
    });
    this.panelCtrl.refresh();
  }

  datasourceChanged() {
    this.panelCtrl.refresh();
  }

  changeTriggerSeverityColor(trigger, color) {
    this.panel.triggerSeverity[trigger.priority].color = color;
    this.refreshTriggerSeverity();
  }

  isRegex(str) {
    return utils.isRegex(str);
  }

  isVariable(str) {
    return utils.isTemplateVariable(str, this.templateSrv.variables);
  }
}

// Get list of metric names for bs-typeahead directive
function getMetricNames(scope, metricList) {
  return _.uniq(_.map(scope.metric[metricList], 'name'));
}

export function triggerPanelEditor() {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/editor.html',
    controller: TriggerPanelEditorCtrl,
  };
}
