define([
    'angular',
    'lodash',
    './metricFunctions',
    './utils'
  ],
  function (angular, _, metricFunctions, Utils) {
    'use strict';

    var module = angular.module('grafana.controllers');
    var targetLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    module.controller('ZabbixAPIQueryCtrl', function ($scope, $sce, $q, templateSrv) {

      var zabbixCache = $scope.datasource.zabbixCache;

      $scope.init = function () {
        $scope.targetLetters = targetLetters;

        if (!$scope.metric) {
          $scope.metric = {};
        }

        // Load default values
        var targetDefaults = {
          mode: 0,
          group: { filter: "" },
          host: { filter: "" },
          application: { filter: "" },
          item: { filter: "" },
          functions: [],
        };
        _.defaults($scope.target, targetDefaults);

        // Create function instances from saved JSON
        $scope.target.functions = _.map($scope.target.functions, function(func) {
          return metricFunctions.createFuncInstance(func.def, func.params);
        });

        if ($scope.target.mode === 0 ||
            $scope.target.mode === 2) {

          $scope.downsampleFunctionList = [
            {name: "avg", value: "avg"},
            {name: "min", value: "min"},
            {name: "max", value: "max"}
          ];

          // Set avg by default
          if (!$scope.target.downsampleFunction) {
            $scope.target.downsampleFunction = $scope.downsampleFunctionList[0];
          }

          // Load metrics from cache
          $scope.getMetricsFromCache().then(function() {
            $scope.initFilters();
          });
        }
        else if ($scope.target.mode === 1) {
          $scope.slaPropertyList = [
            {name: "Status", property: "status"},
            {name: "SLA", property: "sla"},
            {name: "OK time", property: "okTime"},
            {name: "Problem time", property: "problemTime"},
            {name: "Down time", property: "downtimeTime"}
          ];
          $scope.itserviceList = [{name: "test"}];
          $scope.updateITServiceList();
        }
      };

      $scope.initFilters = function () {
        $scope.filterHosts();
        $scope.filterApplications();
        $scope.filterItems();
      };

      $scope.getMetricsFromCache = function() {
        var item_type = $scope.editorModes[$scope.target.mode];
        var promises = [
          zabbixCache.getGroups(),
          zabbixCache.getHosts(),
          zabbixCache.getApplications(),
          zabbixCache.getItems(item_type)
        ];
        return $q.all(promises).then(function(results) {
          $scope.metric = {
            groupList: results[0],
            hostList: results[1],
            applicationList: results[2],
            itemList: results[3]
          };
        });
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

      $scope.filterHosts = function () {
        var groupFilter = templateSrv.replace($scope.target.group.filter);
        $scope.datasource.queryProcessor.filterHosts(groupFilter).then(function(hosts) {
          $scope.metric.filteredHosts = hosts;
        });
      };

      $scope.filterApplications = function () {
        var hostFilter = templateSrv.replace($scope.target.host.filter);
        $scope.datasource.queryProcessor.filterApplications(hostFilter).then(function(apps) {
          $scope.metric.filteredApplications = apps;
        });
      };

      $scope.filterItems = function () {
        var hostFilter = templateSrv.replace($scope.target.host.filter);
        var appFilter = templateSrv.replace($scope.target.application.filter);
        $scope.datasource.queryProcessor.filterItems(hostFilter, appFilter, $scope.target.showDisabledItems)
          .then(function(items) {
            $scope.metric.filteredItems = items;
          });
      };

      $scope.onTargetPartChange = function (targetPart) {
        var regexStyle = {'color': '#CCA300'};
        targetPart.isRegex = Utils.isRegex(targetPart.filter);
        targetPart.style = targetPart.isRegex ? regexStyle : {};
      };

      // Handle group blur and filter hosts
      $scope.onGroupBlur = function() {
        $scope.filterHosts();
        $scope.parseTarget();
        $scope.get_data();
      };

      // Handle host blur and filter applications
      $scope.onHostBlur = function() {
        $scope.filterApplications();
        $scope.parseTarget();
        $scope.get_data();
      };

      // Handle application blur and filter items
      $scope.onApplicationBlur = function() {
        $scope.filterItems();
        $scope.parseTarget();
        $scope.get_data();
      };

      $scope.onItemBlur = function () {
        $scope.parseTarget();
        $scope.get_data();
      };

      $scope.parseTarget = function() {
        // Parse target
      };

      $scope.targetChanged = function() {
        //console.log($scope.target);
        $scope.get_data();
      };

      // Validate target and set validation info
      $scope.validateTarget = function () {};

      $scope.addFunction = function(funcDef) {
        var newFunc = metricFunctions.createFuncInstance(funcDef);
        newFunc.added = true;
        $scope.target.functions.push(newFunc);

        $scope.moveAliasFuncLast();

        if (newFunc.params.length && newFunc.added ||
            newFunc.def.params.length === 0) {
          $scope.targetChanged();
        }
      };

      $scope.removeFunction = function(func) {
        $scope.target.functions = _.without($scope.target.functions, func);
        $scope.targetChanged();
      };

      $scope.moveAliasFuncLast = function() {
        var aliasFunc = _.find($scope.target.functions, function(func) {
          return func.def.name === 'alias' ||
            func.def.name === 'aliasByNode' ||
            func.def.name === 'aliasByMetric';
        });

        if (aliasFunc) {
          $scope.target.functions = _.without($scope.target.functions, aliasFunc);
          $scope.target.functions.push(aliasFunc);
        }
      };

      $scope.functionChanged = function() {};

      $scope.editorModes = {
        0: 'num',
        1: 'itservice',
        2: 'text'
      };

      /**
       * Switch query editor to specified mode.
       * Modes:
       *  0 - items
       *  1 - IT services
       *  2 - Text metrics
       */
      $scope.switchEditorMode = function (mode) {
        $scope.target.mode = mode;
        $scope.init();
      };

      /**
       * Take alias from item name by default
       */
      function setItemAlias() {
        if (!$scope.target.alias && $scope.target.item) {
          $scope.target.alias = $scope.target.item.name;
        }
      }

      $scope.targetBlur = function () {
        setItemAlias();
        if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
          $scope.oldTarget = angular.copy($scope.target);
          $scope.get_data();
        }
      };

      /**
       * Call when IT service is selected.
       */
      $scope.selectITService = function () {
        if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
          $scope.oldTarget = angular.copy($scope.target);
          $scope.get_data();
        }
      };

      $scope.duplicate = function () {
        var clone = angular.copy($scope.target);
        $scope.panel.targets.push(clone);
      };

      $scope.moveMetricQuery = function (fromIndex, toIndex) {
        _.move($scope.panel.targets, fromIndex, toIndex);
      };

      /**
       * Update list of IT services
       */
      $scope.updateITServiceList = function () {
        $scope.datasource.zabbixAPI.getITService().then(function (iteservices) {
          $scope.itserviceList = [];
          $scope.itserviceList = $scope.itserviceList.concat(iteservices);
        });
      };

      /**
       * Add templated variables to list of available metrics
       *
       * @param {Array} metricList List of metrics which variables add to
       */
      function addTemplatedVariables(metricList) {
        _.each(templateSrv.variables, function (variable) {
          metricList.push({
            name: '$' + variable.name,
            templated: true
          });
        });
      }

      $scope.init();

    });

  });
