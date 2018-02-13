import _ from 'lodash';
import * as utils from '../datasource-zabbix/utils';
import {DEFAULT_TARGET} from './triggers_panel_ctrl';

class TriggersTabCtrl {

  /** @ngInject */
  constructor($scope, $rootScope, uiSegmentSrv, templateSrv) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.templateSrv = templateSrv;
    this.datasources = this.panelCtrl.datasources;

    // Load scope defaults
    var scopeDefaults = {
      getGroupNames: {},
      getHostNames: {},
      getApplicationNames: {},
      oldTarget: _.cloneDeep(this.panel.targets)
    };
    _.defaultsDeep(this, scopeDefaults);

    this.initDatasources();
    this.panelCtrl.refresh();
  }

  initDatasources() {
    return this.panelCtrl.initDatasources()
    .then((datasources) => {
      _.each(datasources, (datasource) => {
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
  }

  suggestGroups(datasource, query, callback) {
    return datasource.zabbix.getAllGroups()
    .then(groups => {
      return _.map(groups, 'name');
    })
    .then(callback);
  }

  suggestHosts(datasource, query, callback) {
    let groupFilter = datasource.replaceTemplateVars(this.panel.targets[datasource.name].group.filter);
    return datasource.zabbix.getAllHosts(groupFilter)
    .then(hosts => {
      return _.map(hosts, 'name');
    })
    .then(callback);
  }

  suggestApps(datasource, query, callback) {
    let groupFilter = datasource.replaceTemplateVars(this.panel.targets[datasource.name].group.filter);
    let hostFilter = datasource.replaceTemplateVars(this.panel.targets[datasource.name].host.filter);
    return datasource.zabbix.getAllApps(groupFilter, hostFilter)
    .then(apps => {
      return _.map(apps, 'name');
    })
    .then(callback);
  }

  datasourcesChanged() {
    _.each(this.panel.datasources, (ds) => {
      if (!this.panel.targets[ds]) {
        this.panel.targets[ds] = _.cloneDeep(DEFAULT_TARGET);
      }
    });
    this.parseTarget();
  }

  parseTarget() {
    this.initDatasources()
    .then(() => {
      var newTarget = _.cloneDeep(this.panel.targets);
      if (!_.isEqual(this.oldTarget, newTarget)) {
        this.oldTarget = newTarget;
      }
      this.panelCtrl.refresh();
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
