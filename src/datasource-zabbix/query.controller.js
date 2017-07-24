import {QueryCtrl} from 'app/plugins/sdk';
import angular from 'angular';
import _ from 'lodash';
import * as c from './constants';
import * as utils from './utils';
import * as metricFunctions from './metricFunctions';
import * as migrations from './migrations';

import './add-metric-function.directive';
import './metric-function-editor.directive';

import './css/query-editor.css!';

export class ZabbixQueryController extends QueryCtrl {

  // ZabbixQueryCtrl constructor
  constructor($scope, $injector, $rootScope, $sce, templateSrv) {
    super($scope, $injector);
    this.zabbix = this.datasource.zabbix;

    // Use custom format for template variables
    this.replaceTemplateVars = this.datasource.replaceTemplateVars;
    this.templateSrv = templateSrv;

    this.editorModes = {
      0: {value: 'num',       text: 'Metrics',     mode: c.MODE_METRICS},
      1: {value: 'itservice', text: 'IT Services', mode: c.MODE_ITSERVICE},
      2: {value: 'text',      text: 'Text',        mode: c.MODE_TEXT}
    };

    this.slaPropertyList = [
      {name: "Status", property: "status"},
      {name: "SLA", property: "sla"},
      {name: "OK time", property: "okTime"},
      {name: "Problem time", property: "problemTime"},
      {name: "Down time", property: "downtimeTime"}
    ];

    // Map functions for bs-typeahead
    this.getGroupNames = _.bind(this.getMetricNames, this, 'groupList');
    this.getHostNames = _.bind(this.getMetricNames, this, 'hostList', true);
    this.getApplicationNames = _.bind(this.getMetricNames, this, 'appList');
    this.getItemNames = _.bind(this.getMetricNames, this, 'itemList');
    this.getITServices = _.bind(this.getMetricNames, this, 'itServiceList');

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
        mode: c.MODE_METRICS,
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

      if (target.mode === c.MODE_METRICS ||
          target.mode === c.MODE_TEXT) {

        this.downsampleFunctionList = [
          {name: "avg", value: "avg"},
          {name: "min", value: "min"},
          {name: "max", value: "max"},
          {name: "sum", value: "sum"},
          {name: "count", value: "count"}
        ];

        this.initFilters();
      }
      else if (target.mode === c.MODE_ITSERVICE) {
        _.defaults(target, {slaProperty: {name: "SLA", property: "sla"}});
        this.suggestITServices();
      }
    };

    this.init();
  }

  initFilters() {
    let itemtype = this.editorModes[this.target.mode].value;
    return Promise.all([
      this.suggestGroups(),
      this.suggestHosts(),
      this.suggestApps(),
      this.suggestItems(itemtype)
    ]);
  }

  // Get list of metric names for bs-typeahead directive
  getMetricNames(metricList, addAllValue) {
    let metrics = _.uniq(_.map(this.metric[metricList], 'name'));

    // Add template variables
    _.forEach(this.templateSrv.variables, variable => {
      metrics.unshift('$' + variable.name);
    });

    if (addAllValue) {
      metrics.unshift('/.*/');
    }

    return metrics;
  }

  suggestGroups() {
    return this.zabbix.getAllGroups()
    .then(groups => {
      this.metric.groupList = groups;
      return groups;
    });
  }

  suggestHosts() {
    let groupFilter = this.replaceTemplateVars(this.target.group.filter);
    return this.zabbix.getAllHosts(groupFilter)
    .then(hosts => {
      this.metric.hostList = hosts;
      return hosts;
    });
  }

  suggestApps() {
    let groupFilter = this.replaceTemplateVars(this.target.group.filter);
    let hostFilter = this.replaceTemplateVars(this.target.host.filter);
    return this.zabbix.getAllApps(groupFilter, hostFilter)
    .then(apps => {
      this.metric.appList = apps;
      return apps;
    });
  }

  suggestItems(itemtype = 'num') {
    let groupFilter = this.replaceTemplateVars(this.target.group.filter);
    let hostFilter = this.replaceTemplateVars(this.target.host.filter);
    let appFilter = this.replaceTemplateVars(this.target.application.filter);
    let options = {
      itemtype: itemtype,
      showDisabledItems: this.target.options.showDisabledItems
    };

    return this.zabbix
    .getAllItems(groupFilter, hostFilter, appFilter, options)
    .then(items => {
      this.metric.itemList = items;
      return items;
    });
  }

  suggestITServices() {
    return this.zabbix.getITService()
    .then(itservices => {
      this.metric.itServiceList = itservices;
      return itservices;
    });
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
    return _.some(['group', 'host', 'application'], field => {
      if (this.target[field] && this.target[field].filter) {
        return utils.isTemplateVariable(this.target[field].filter, this.templateSrv.variables);
      } else {
        return false;
      }
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
    this.zabbix.getITService().then((iteservices) => {
      this.itserviceList = [];
      this.itserviceList = this.itserviceList.concat(iteservices);
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
