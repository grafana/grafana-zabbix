import _ from 'lodash';
import * as utils from '../datasource-zabbix/utils';
import './datasource-selector.directive';
import '../datasource-zabbix/css/query-editor.css!';

const ZABBIX_DS_ID = 'alexanderzobnin-zabbix-datasource';
const DEFAULT_TARGET = {
  group: {filter: ""},
  host: {filter: ""},
  application: {filter: ""},
  trigger: {filter: ""}
};

class TriggersTabCtrl {

  /** @ngInject */
  constructor($scope, $rootScope, uiSegmentSrv, datasourceSrv, templateSrv) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;

    // Load scope defaults
    var scopeDefaults = {
      datasources: {},
      getGroupNames: {},
      getHostNames: {},
      getApplicationNames: {},
      oldTarget: _.cloneDeep(this.panel.targets)
    };
    _.defaultsDeep(this, scopeDefaults);

    this.available_datasources = _.map(this.getZabbixDataSources(), 'name');
    if (!this.panel.datasource) {
      this.panel.datasource = this.available_datasources[0];
    }

    this.initDatasources();
    this.panelCtrl.refresh();
  }

  initDatasources() {
    _.each(this.panel.datasources, (ds) => {
      // Load datasource
      this.datasourceSrv.get(ds)
      .then(datasource => {
        this.panelCtrl.datasources[ds] = datasource;
        this.datasources[ds] = datasource;

        // Map functions for bs-typeahead
        this.getGroupNames[ds] = _.bind(this.suggestGroups, this, datasource);
        this.getHostNames[ds] = _.bind(this.suggestHosts, this, datasource);
        this.getApplicationNames[ds] = _.bind(this.suggestApps, this, datasource);
      });
    });
  }

  getZabbixDataSources() {
    return _.filter(this.datasourceSrv.getMetricSources(), datasource => {
      return datasource.meta.id === ZABBIX_DS_ID && datasource.value;
    });
  }

  suggestGroups(ds, query, callback) {
    return ds.zabbix.getAllGroups()
    .then(groups => {
      return _.map(groups, 'name');
    })
    .then(callback);
  }

  suggestHosts(ds, query, callback) {
    let groupFilter = ds.replaceTemplateVars(this.panel.targets[ds.name].group.filter);
    return ds.zabbix.getAllHosts(groupFilter)
    .then(hosts => {
      return _.map(hosts, 'name');
    })
    .then(callback);
  }

  suggestApps(ds, query, callback) {
    let groupFilter = ds.replaceTemplateVars(this.panel.targets[ds.name].group.filter);
    let hostFilter = ds.replaceTemplateVars(this.panel.targets[ds.name].host.filter);
    return ds.zabbix.getAllApps(groupFilter, hostFilter)
    .then(apps => {
      return _.map(apps, 'name');
    })
    .then(callback);
  }

  datasourcesChanged() {
    _.each(this.panel.datasources, (ds) => {
      if (!this.panel.targets[ds]) {
        this.panel.targets[ds] = DEFAULT_TARGET;
      }
    });
    this.parseTarget();
  }

  parseTarget() {
    this.initDatasources();
    var newTarget = _.cloneDeep(this.panel.targets);
    if (!_.isEqual(this.oldTarget, newTarget)) {
      this.oldTarget = newTarget;
    }
    this.panelCtrl.refresh();
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
