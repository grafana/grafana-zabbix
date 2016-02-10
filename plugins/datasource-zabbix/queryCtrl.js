define([
  'app/plugins/sdk',
  'angular',
  'lodash',
  './metricFunctions',
  './utils'
],
function (sdk, angular, _, metricFunctions, utils) {
  'use strict';

  var ZabbixQueryCtrl = (function(_super)  {

    // ZabbixQueryCtrl constructor
    function ZabbixQueryCtrl($scope, $injector, $sce, $q, templateSrv) {

      // Call superclass constructor
      _super.call(this, $scope, $injector);

      this.editorModes = {
        0: 'num',
        1: 'itservice',
        2: 'text'
      };

      // Map functions for bs-typeahead
      this.getGroupNames = _.partial(getMetricNames, this, 'groupList');
      this.getHostNames = _.partial(getMetricNames, this, 'filteredHosts');
      this.getApplicationNames = _.partial(getMetricNames, this, 'filteredApplications');
      this.getItemNames = _.partial(getMetricNames, this, 'filteredItems');

      this.init = function() {

        this.templateSrv = templateSrv;
        var target = this.target;

        var scopeDefaults = {
          metric: {}
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

          // Set avg by default
          if (!target.downsampleFunction) {
            target.downsampleFunction = this.downsampleFunctionList[0];
          }

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

    ZabbixQueryCtrl.templateUrl = 'partials/query.editor.html';

    ZabbixQueryCtrl.prototype = Object.create(_super.prototype);
    ZabbixQueryCtrl.prototype.constructor = ZabbixQueryCtrl;

    var p = ZabbixQueryCtrl.prototype;

    p.initFilters = function () {
      this.filterGroups();
      this.filterHosts();
      this.filterApplications();
      this.filterItems();
    };

    p.filterHosts = function () {
      var self = this;
      var groupFilter = this.templateSrv.replace(this.target.group.filter);
      this.datasource.queryProcessor.filterHosts(groupFilter).then(function(hosts) {
        self.metric.filteredHosts = hosts;
      });
    };

    p.filterGroups = function() {
      var self = this;
      this.datasource.queryProcessor.filterGroups().then(function(groups) {
        self.metric.groupList = groups;
      });
    };

    p.filterApplications = function () {
      var self = this;
      var groupFilter = this.templateSrv.replace(this.target.group.filter);
      var hostFilter = this.templateSrv.replace(this.target.host.filter);
      this.datasource.queryProcessor.filterApplications(groupFilter, hostFilter)
        .then(function(apps) {
          self.metric.filteredApplications = apps;
        });
    };

    p.filterItems = function () {
      var self = this;
      var item_type = this.editorModes[this.target.mode];
      var groupFilter = this.templateSrv.replace(this.target.group.filter);
      var hostFilter = this.templateSrv.replace(this.target.host.filter);
      var appFilter = this.templateSrv.replace(this.target.application.filter);
      this.datasource.queryProcessor.filterItems(groupFilter, hostFilter, appFilter,
        item_type, this.target.showDisabledItems).then(function(items) {
          self.metric.filteredItems = items;
        });
    };

    p.onTargetPartChange = function (targetPart) {
      var regexStyle = {'color': '#CCA300'};
      targetPart.isRegex = utils.isRegex(targetPart.filter);
      targetPart.style = targetPart.isRegex ? regexStyle : {};
    };

    p.onTargetBlur = function() {
      this.initFilters();
      this.parseTarget();
      this.panelCtrl.refresh();
    };

    p.parseTarget = function() {
      // Parse target
    };

    // Validate target and set validation info
    p.validateTarget = function () {};

    p.targetChanged = function() {
      this.panelCtrl.refresh();
    };

    p.addFunction = function(funcDef) {
      var newFunc = metricFunctions.createFuncInstance(funcDef);
      newFunc.added = true;
      this.target.functions.push(newFunc);

      this.moveAliasFuncLast();

      if (newFunc.params.length && newFunc.added ||
          newFunc.def.params.length === 0) {
        this.targetChanged();
      }
    };

    p.removeFunction = function(func) {
      this.target.functions = _.without(this.target.functions, func);
      this.targetChanged();
    };

    p.moveAliasFuncLast = function() {
      var aliasFunc = _.find(this.target.functions, function(func) {
        return func.def.name === 'alias' ||
          func.def.name === 'aliasByNode' ||
          func.def.name === 'aliasByMetric';
      });

      if (aliasFunc) {
        this.target.functions = _.without(this.target.functions, aliasFunc);
        this.target.functions.push(aliasFunc);
      }
    };

    /**
     * Switch query editor to specified mode.
     * Modes:
     *  0 - items
     *  1 - IT services
     *  2 - Text metrics
     */
    p.switchEditorMode = function (mode) {
      this.target.mode = mode;
      this.init();
    };

    /////////////////
    // IT Services //
    /////////////////

    /**
     * Update list of IT services
     */
    p.updateITServiceList = function () {
      var self = this;
      this.datasource.zabbixAPI.getITService().then(function (iteservices) {
        self.itserviceList = [];
        self.itserviceList = self.itserviceList.concat(iteservices);
      });
    };

    /**
     * Call when IT service is selected.
     */
    p.selectITService = function () {
      if (!_.isEqual(this.oldTarget, this.target) && _.isEmpty(this.target.errors)) {
        this.oldTarget = angular.copy(this.target);
        this.panelCtrl.refresh();
      }
    };

    return ZabbixQueryCtrl;

  })(sdk.QueryCtrl);

  return ZabbixQueryCtrl;

  // Get list of metric names for bs-typeahead directive
  function getMetricNames(scope, metricList) {
    return _.uniq(_.map(scope.metric[metricList], 'name'));
  }

});