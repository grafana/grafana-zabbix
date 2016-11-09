import {QueryCtrl} from 'app/plugins/sdk';
import angular from 'angular';
import _ from 'lodash';
import * as utils from './utils';
import * as metricFunctions from './metricFunctions';
import * as migrations from './migrations';

import './add-metric-function.directive';
import './metric-function-editor.directive';

import './css/query-editor.css!';

export class ZabbixQueryController extends QueryCtrl {

  // ZabbixQueryCtrl constructor
  constructor($scope, $injector, $rootScope, $sce, $q, templateSrv) {

    // Call superclass constructor
    super($scope, $injector);

    this.zabbix = this.datasource.zabbixAPI;
    this.cache = this.datasource.zabbixCache;
    this.$q = $q;

    // Use custom format for template variables
    this.replaceTemplateVars = this.datasource.replaceTemplateVars;
    this.templateSrv = templateSrv;

    this.editorModes = {
      0: {value: 'num', text: 'Metrics', mode: 0},
      1: {value: 'itservice', text: 'IT Services', mode: 1},
      2: {value: 'text', text: 'Text', mode: 2}
    };

    // Map functions for bs-typeahead
    this.getGroupNames = _.partial(getMetricNames, this, 'groupList');
    this.getHostNames = _.partial(getMetricNames, this, 'hostList');
    this.getApplicationNames = _.partial(getMetricNames, this, 'appList');
    this.getItemNames = _.partial(getMetricNames, this, 'itemList');

    // Update metric suggestion when template variable was changed
    $rootScope.$on('template-variable-value-updated', () => this.onVariableChange());

    // Update metrics when item selected from dropdown
    $scope.$on('typeahead-updated', () => {
      this.onTargetBlur();
    });

    this.init = function() {
      var target = this.target;

      // Migrate old targets
      target = migrations.migrate(target);

      var scopeDefaults = {
        metric: {},
        oldTarget: _.cloneDeep(this.target),
        queryOptionsText: this.renderQueryOptionsText()
      };
      _.defaults(this, scopeDefaults);

      // Load default values
      var targetDefaults = {
        mode: 0,
        group: { filter: "" },
        host: { filter: "" },
        application: { filter: "" },
        item: { filter: "" },
        functions: [],
        options: {
          showDisabledItems: false
        }
      };
      _.defaults(target, targetDefaults);

      // Create function instances from saved JSON
      target.functions = _.map(target.functions, function(func) {
        return metricFunctions.createFuncInstance(func.def, func.params);
      });

      if (target.mode === 0 ||
          target.mode === 2) {

        this.downsampleFunctionList = [
          {name: "avg", value: "avg"},
          {name: "min", value: "min"},
          {name: "max", value: "max"}
        ];

        this.initFilters();
      }
      else if (target.mode === 1) {
        this.slaPropertyList = [
          {name: "Status", property: "status"},
          {name: "SLA", property: "sla"},
          {name: "OK time", property: "okTime"},
          {name: "Problem time", property: "problemTime"},
          {name: "Down time", property: "downtimeTime"}
        ];
        this.itserviceList = [{name: "test"}];
        this.updateITServiceList();
      }
    };

    this.init();
  }

  initFilters() {
    var self = this;
    var itemtype = self.editorModes[self.target.mode].value;
    return this.$q.when(this.suggestGroups())
      .then(() => {return self.suggestHosts();})
      .then(() => {return self.suggestApps();})
      .then(() => {return self.suggestItems(itemtype);});
  }

  suggestGroups() {
    var self = this;
    return this.cache.getGroups().then(groups => {
      self.metric.groupList = groups;
      return groups;
    });
  }

  suggestHosts() {
    var self = this;
    var groupFilter = this.replaceTemplateVars(this.target.group.filter);
    return this.datasource.queryProcessor
      .filterGroups(self.metric.groupList, groupFilter)
      .then(groups => {
        var groupids = _.map(groups, 'groupid');
        return self.zabbix
          .getHosts(groupids)
          .then(hosts => {
            self.metric.hostList = hosts;
            return hosts;
          });
      });
  }

  suggestApps() {
    var self = this;
    var hostFilter = this.replaceTemplateVars(this.target.host.filter);
    return this.datasource.queryProcessor
      .filterHosts(self.metric.hostList, hostFilter)
      .then(hosts => {
        var hostids = _.map(hosts, 'hostid');
        return self.zabbix
          .getApps(hostids)
          .then(apps => {
            return self.metric.appList = apps;
          });
      });
  }

  suggestItems(itemtype='num') {
    var self = this;
    var appFilter = this.replaceTemplateVars(this.target.application.filter);
    if (appFilter) {
      // Filter by applications
      return this.datasource.queryProcessor
        .filterApps(self.metric.appList, appFilter)
        .then(apps => {
          var appids = _.map(apps, 'applicationid');
          return self.zabbix
            .getItems(undefined, appids, itemtype)
            .then(items => {
              if (!self.target.options.showDisabledItems) {
                items = _.filter(items, {'status': '0'});
              }
              self.metric.itemList = items;
              return items;
            });
        });
    } else {
      // Return all items belonged to selected hosts
      var hostids = _.map(self.metric.hostList, 'hostid');
      return self.zabbix
        .getItems(hostids, undefined, itemtype)
        .then(items => {
          if (!self.target.options.showDisabledItems) {
            items = _.filter(items, {'status': '0'});
          }
          self.metric.itemList = items;
          return items;
        });
    }
  }

  isRegex(str) {
    return utils.isRegex(str);
  }

  isVariable(str) {
    return utils.isTemplateVariable(str, this.templateSrv.variables);
  }

  onTargetBlur() {
    var newTarget = _.cloneDeep(this.target);
    if (!_.isEqual(this.oldTarget, this.target)) {
      this.oldTarget = newTarget;
      this.targetChanged();
    }
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
      return _.some(['group', 'host', 'application', 'item'], field => {
        return self.templateSrv.containsVariable(self.target[field].filter, variable.name);
      });
    });
  }

  parseTarget() {
    // Parse target
  }

  // Validate target and set validation info
  validateTarget() {
    // validate
  }

  targetChanged() {
    this.initFilters();
    this.parseTarget();
    this.panelCtrl.refresh();
  }

  addFunction(funcDef) {
    var newFunc = metricFunctions.createFuncInstance(funcDef);
    newFunc.added = true;
    this.target.functions.push(newFunc);

    this.moveAliasFuncLast();

    if (newFunc.params.length && newFunc.added ||
        newFunc.def.params.length === 0) {
      this.targetChanged();
    }
  }

  removeFunction(func) {
    this.target.functions = _.without(this.target.functions, func);
    this.targetChanged();
  }

  moveAliasFuncLast() {
    var aliasFunc = _.find(this.target.functions, function(func) {
      return func.def.name === 'alias' ||
        func.def.name === 'aliasByNode' ||
        func.def.name === 'aliasByMetric';
    });

    if (aliasFunc) {
      this.target.functions = _.without(this.target.functions, aliasFunc);
      this.target.functions.push(aliasFunc);
    }
  }

  toggleQueryOptions() {
    this.showQueryOptions = !this.showQueryOptions;
  }

  onQueryOptionChange() {
    this.queryOptionsText = this.renderQueryOptionsText();
    this.onTargetBlur();
  }

  renderQueryOptionsText() {
    var optionsMap = {
      showDisabledItems: "Show disabled items"
    };
    var options = [];
    _.forOwn(this.target.options, (value, key) => {
      if (value) {
        if (value === true) {
          // Show only option name (if enabled) for boolean options
          options.push(optionsMap[key]);
        } else {
          // Show "option = value" for another options
          options.push(optionsMap[key] + " = " + value);
        }
      }
    });
    return "Options: " + options.join(', ');
  }

  /**
   * Switch query editor to specified mode.
   * Modes:
   *  0 - items
   *  1 - IT services
   *  2 - Text metrics
   */
  switchEditorMode(mode) {
    this.target.mode = mode;
    this.init();
  }

  /////////////////
  // IT Services //
  /////////////////

  /**
   * Update list of IT services
   */
  updateITServiceList() {
    var self = this;
    this.datasource.zabbixAPI.getITService().then(function (iteservices) {
      self.itserviceList = [];
      self.itserviceList = self.itserviceList.concat(iteservices);
    });
  }

  /**
   * Call when IT service is selected.
   */
  selectITService() {
    if (!_.isEqual(this.oldTarget, this.target) && _.isEmpty(this.target.errors)) {
      this.oldTarget = angular.copy(this.target);
      this.panelCtrl.refresh();
    }
  }

}

// Set templateUrl as static property
ZabbixQueryController.templateUrl = 'datasource-zabbix/partials/query.editor.html';

// Get list of metric names for bs-typeahead directive
function getMetricNames(scope, metricList) {
  return _.uniq(_.map(scope.metric[metricList], 'name'));
}
