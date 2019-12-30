import _ from 'lodash';
import * as utils from '../datasource-zabbix/utils';
import { getDefaultTarget } from './triggers_panel_ctrl';

class TriggersTabCtrl {

  /** @ngInject */
  constructor($scope, $rootScope, uiSegmentSrv, templateSrv) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.templateSrv = templateSrv;
    this.datasources = {};

    // Load scope defaults
    var scopeDefaults = {
      getGroupNames: {},
      getHostNames: {},
      getApplicationNames: {},
      getProxyNames: {},
      oldTarget: _.cloneDeep(this.panel.targets)
    };
    _.defaultsDeep(this, scopeDefaults);
    this.selectedDatasources = this.getSelectedDatasources();

    this.initDatasources();
    this.panelCtrl.refresh();
  }

  initDatasources() {
    return this.panelCtrl.initDatasources()
    .then((datasources) => {
      _.each(datasources, (datasource) => {
        this.datasources[datasource.name] = datasource;
        this.bindSuggestionFunctions(datasource);
      });
    });
  }

  bindSuggestionFunctions(datasource) {
    // Map functions for bs-typeahead
    let ds = datasource.name;
    this.getGroupNames[ds] = _.bind(this.suggestGroups, this, datasource);
    this.getHostNames[ds] = _.bind(this.suggestHosts, this, datasource);
    this.getApplicationNames[ds] = _.bind(this.suggestApps, this, datasource);
    this.getProxyNames[ds] = _.bind(this.suggestProxies, this, datasource);
  }

  getSelectedDatasources() {
    return _.compact(this.panel.targets.map(target => target.datasource));
  }

  suggestGroups(datasource, query, callback) {
    return datasource.zabbix.getAllGroups()
    .then(groups => {
      return _.map(groups, 'name');
    })
    .then(callback);
  }

  suggestHosts(datasource, query, callback) {
    const target = this.panel.targets.find(t => t.datasource === datasource.name);
    let groupFilter = datasource.replaceTemplateVars(target.group.filter);
    return datasource.zabbix.getAllHosts(groupFilter)
    .then(hosts => {
      return _.map(hosts, 'name');
    })
    .then(callback);
  }

  suggestApps(datasource, query, callback) {
    const target = this.panel.targets.find(t => t.datasource === datasource.name);
    let groupFilter = datasource.replaceTemplateVars(target.group.filter);
    let hostFilter = datasource.replaceTemplateVars(target.host.filter);
    return datasource.zabbix.getAllApps(groupFilter, hostFilter)
    .then(apps => {
      return _.map(apps, 'name');
    })
    .then(callback);
  }

  suggestProxies(datasource, query, callback) {
    return datasource.zabbix.getProxies()
    .then(proxies => _.map(proxies, 'host'))
    .then(callback);
  }

  datasourcesChanged() {
    const newTargets = [];
    _.each(this.selectedDatasources, (ds) => {
      const dsTarget = this.panel.targets.find((target => target.datasource === ds));
      if (dsTarget) {
        newTargets.push(dsTarget);
      } else {
        const newTarget = getDefaultTarget(this.panel.targets);
        newTarget.datasource = ds;
        newTargets.push(newTarget);
      }
      this.panel.targets = newTargets;
    });
    this.parseTarget();
  }

  parseTarget() {
    this.initDatasources()
    .then(() => {
      var newTarget = _.cloneDeep(this.panel.targets);
      if (!_.isEqual(this.oldTarget, newTarget)) {
        this.oldTarget = newTarget;
        this.panelCtrl.refresh();
      }
    });
  }

  isRegex(str) {
    return utils.isRegex(str);
  }

  isVariable(str) {
    return utils.isTemplateVariable(str, this.templateSrv.variables);
  }
}

export function triggerPanelTriggersTab() {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/partials/triggers_tab.html',
    controller: TriggersTabCtrl,
  };
}
