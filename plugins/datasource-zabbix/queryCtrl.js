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

    module.controller('ZabbixAPIQueryCtrl', function ($scope, $sce, templateSrv) {

      var zabbixCache = $scope.datasource.zabbixCache;

      $scope.init = function () {
        $scope.targetLetters = targetLetters;
        $scope.metric = {};

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

        if ($scope.target.mode ===0 ||
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
          if (zabbixCache._initialized) {
            $scope.getMetricsFromCache();
            $scope.initFilters();
            console.log("Cached", $scope.metric);
          } else {
            zabbixCache.refresh().then(function () {
              $scope.getMetricsFromCache();
              $scope.initFilters();
              console.log("From server", $scope.metric);
            });
          }

          setItemAlias();
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
        $scope.onGroupBlur();
        $scope.onHostBlur();
        $scope.onApplicationBlur();
      };

      $scope.getMetricsFromCache = function () {
        $scope.metric = {
          groupList: zabbixCache.getGroups(),
          hostList: zabbixCache.getHosts(),
          applicationList: zabbixCache.getApplications(),
          itemList: zabbixCache.getItems()
        };
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
        var group = $scope.target.group;
        var groups = [];
        var hosts = [];

        // Filter groups by regex
        if (group.isRegex) {
          var filterPattern = Utils.buildRegex(group.filter);
          groups = _.filter($scope.metric.groupList, function (groupObj) {
            return filterPattern.test(groupObj.name);
          });
        }
        // Find hosts in selected group
        else {
          var finded = _.find($scope.metric.groupList, {'name': group.filter});
          if (finded) {
            groups.push(finded);
          } else {
            groups = undefined;
          }
        }

        if (groups) {
          var groupids = _.map(groups, 'groupid');
          hosts = _.filter($scope.metric.hostList, function (hostObj) {
            return _.intersection(groupids, hostObj.groups).length;
          });
        }
        return hosts;
      };

      $scope.filterApplications = function () {
        var host = $scope.target.host;
        var hosts = [];
        var apps = [];

        // Filter hosts by regex
        if (host.isRegex) {
          var filterPattern = Utils.buildRegex(host.filter);
          hosts = _.filter($scope.metric.hostList, function (hostObj) {
            return filterPattern.test(hostObj.name);
          });
        }
        // Find applications in selected host
        else {
          var finded = _.find($scope.metric.hostList, {'name': host.filter});
          if (finded) {
            hosts.push(finded);
          } else {
            hosts = undefined;
          }
        }

        if (hosts) {
          var hostsids = _.map(hosts, 'hostid');
          apps = _.filter($scope.metric.applicationList, function (appObj) {
            return _.intersection(hostsids, appObj.hosts).length;
          });
        }

        return apps;
      };

      $scope.filterItems = function () {
        var app = $scope.target.application;
        var host = $scope.target.host;
        var hosts = [];
        var apps = [];
        var items = [];

        // Filter hosts by regex
        if (host.isRegex) {
          var hostFilterPattern = Utils.buildRegex(host.filter);
          hosts = _.filter($scope.metric.hostList, function (hostObj) {
            return hostFilterPattern.test(hostObj.name);
          });
        }
        else {
          var findedHosts = _.find($scope.metric.hostList, {'name': host.filter});
          if (findedHosts) {
            hosts.push(findedHosts);
          } else {
            hosts = undefined;
          }
        }

        // Filter applications by regex
        if (app.isRegex) {
          var filterPattern = Utils.buildRegex(app.filter);
          apps = _.filter($scope.metric.applicationList, function (appObj) {
            return filterPattern.test(appObj.name);
          });
        }
        // Find items in selected application
        else if (app.filter) {
          var finded = _.find($scope.metric.applicationList, {'name': app.filter});
          if (finded) {
            apps.push(finded);
          } else {
            apps = undefined;
          }
        } else {
          apps = undefined;
          if (hosts) {
            items = _.filter($scope.metric.itemList, function (itemObj) {
              return _.find(hosts, {'hostid': itemObj.hostid });
            });
          }
        }

        if (apps) {
          var appids = _.flatten(_.map(apps, 'applicationids'));
          items = _.filter($scope.metric.itemList, function (itemObj) {
            return _.intersection(appids, itemObj.applications).length;
          });
          items = _.filter(items, function (itemObj) {
            return _.find(hosts, {'hostid': itemObj.hostid });
          });
        }

        if (!$scope.target.showDisabledItems) {
          items = _.filter(items, {'status': '0'});
        }

        return items;
      };

      $scope.onTargetPartChange = function (targetPart) {
        var regexStyle = {'color': '#CCA300'};
        targetPart.isRegex = Utils.isRegex(targetPart.filter);
        targetPart.style = targetPart.isRegex ? regexStyle : {};
      };

      // Handle group blur and filter hosts
      $scope.onGroupBlur = function() {
        $scope.metric.filteredHosts = $scope.filterHosts();
        $scope.parseTarget();
        $scope.get_data();
      };

      // Handle host blur and filter applications
      $scope.onHostBlur = function() {
        $scope.metric.filteredApplications = $scope.filterApplications();
        $scope.parseTarget();
        $scope.get_data();
      };

      // Handle application blur and filter items
      $scope.onApplicationBlur = function() {
        $scope.metric.filteredItems = $scope.filterItems();
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
        console.log($scope.target.functions);
        $scope.get_data();
      };

      // Validate target and set validation info
      $scope.validateTarget = function () {};

      $scope.addFunction = function(funcDef) {
        var newFunc = metricFunctions.createFuncInstance(funcDef, { withDefaultParams: true });
        newFunc.added = true;
        $scope.target.functions.push(newFunc);

        $scope.moveAliasFuncLast();

        if (!newFunc.params.length && newFunc.added) {
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
