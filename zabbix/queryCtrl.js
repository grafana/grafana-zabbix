define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');
  var targetLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  module.controller('ZabbixAPIQueryCtrl', function($scope, $sce, templateSrv) {

    $scope.init = function() {
      $scope.targetLetters = targetLetters;
      $scope.metric = {
        hostGroupList: ["Loading..."],
        hostList: ["Loading..."],
        applicationList: ["Loading..."],
        itemList: ["Loading..."]
      };

      // Update host group, host, application and item lists
      $scope.updateGroupList();
      $scope.updateHostList();
      $scope.updateAppList();
      $scope.updateItemList();

      setItemAlias();

      $scope.target.errors = validateTarget($scope.target);
    };


    /**
     * Take alias from item name by default
     */
    function setItemAlias() {
      if (!$scope.target.alias && $scope.target.item) {
        $scope.target.alias = expandItemName($scope.target.item);
      }
    };


    $scope.targetBlur = function() {
      setItemAlias();
      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };


    /**
     * Call when host group selected
     */
    $scope.selectHostGroup = function() {
      $scope.updateHostList()
      $scope.updateAppList();

      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };


    /**
     * Call when host selected
     */
    $scope.selectHost = function() {
      $scope.updateItemList();
      $scope.updateAppList();

      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };


    /**
     * Call when application selected
     */
    $scope.selectApplication = function() {
      $scope.updateItemList();

      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };


    /**
     * Call when item selected
     */
    $scope.selectItem = function() {
      setItemAlias();
      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };


    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };


    $scope.moveMetricQuery = function(fromIndex, toIndex) {
      _.move($scope.panel.targets, fromIndex, toIndex);
    };

    //////////////////////////////
    // SUGGESTION QUERIES
    //////////////////////////////


    /**
     * Update list of host groups
     */
    $scope.updateGroupList = function() {
      $scope.metric.groupList = [];
      addTemplatedVariables($scope.metric.groupList);

      $scope.datasource.performHostGroupSuggestQuery().then(function (series) {
        $scope.metric.groupList = $scope.metric.groupList.concat(series);

        if ($scope.target.hostGroup) {
          $scope.target.hostGroup = $scope.metric.groupList.filter(function (item, index, array) {
            // Find selected host in metric.hostList
            return item.name == $scope.target.hostGroup.name;
          }).pop();
        }
      });
    };


    /**
     * Update list of hosts
     */
    $scope.updateHostList = function() {
      $scope.metric.hostList = [];
      addTemplatedVariables($scope.metric.hostList);

      var groupid = $scope.target.hostGroup ? $scope.target.hostGroup.groupid: null;
      $scope.datasource.performHostSuggestQuery(groupid).then(function (series) {
        $scope.metric.hostList = $scope.metric.hostList.concat(series);

        if ($scope.target.host) {
          $scope.target.host = $scope.metric.hostList.filter(function (item, index, array) {
            // Find selected host in metric.hostList
            return item.name == $scope.target.host.name;
          }).pop();
        }
      });
    };


    /**
     * Update list of host applications
     */
    $scope.updateAppList = function() {
      $scope.metric.applicationList = [];
      addTemplatedVariables($scope.metric.applicationList);

      var hostid = $scope.target.host ? $scope.target.host.hostid : null;
      var groupid = $scope.target.hostGroup ? $scope.target.hostGroup.groupid: null;
      $scope.datasource.performAppSuggestQuery(hostid, groupid).then(function (series) {
        var apps = _.map(_.uniq(_.map(series, 'name')), function (appname) {
          return {name: appname};
        });
        $scope.metric.applicationList = $scope.metric.applicationList.concat(apps);

        if ($scope.target.application) {
          $scope.target.application = $scope.metric.applicationList.filter(function (app) {
            // Find selected application in metric.hostList
            return app.name == $scope.target.application.name;
          }).pop();
        }
      });
    };


    /**
     * Update list of items
     */
    $scope.updateItemList = function() {
      $scope.metric.itemList = [];
      addTemplatedVariables($scope.metric.itemList);

      var groupids = $scope.target.hostGroup ? $scope.target.hostGroup.groupid: null;
      var hostids = $scope.target.host ? $scope.target.host.hostid : null;
      var application = $scope.target.application || null;

      // Get application ids from name
      $scope.datasource.findZabbixApp(application).then(function (result) {
        var applicationids = _.map(result, 'applicationid');
        $scope.datasource.performItemSuggestQuery(hostids, applicationids, groupids).then(function (series) {
          $scope.metric.itemList = $scope.metric.itemList.concat(series);

          // Expand item parameters
          $scope.metric.itemList.forEach(function (item, index, array) {
            if (item && item.key_ && item.name) {
              item.name = expandItemName(item);
            }
          });
          if ($scope.target.item) {
            $scope.target.item = $scope.metric.itemList.filter(function (item, index, array) {
              // Find selected item in metric.hostList
              return item.name == $scope.target.item.name;
            }).pop();
          }
        });
      });
    };


    /**
     * Add templated variables to list of available metrics
     *
     * @param {Array} metricList List of metrics which variables add to
     */
    function addTemplatedVariables(metricList) {
      _.each(templateSrv.variables, function(variable) {
        metricList.push({
          name: '$' + variable.name,
          templated: true
        })
      });
    };


    /**
     * Expand item parameters, for example:
     * CPU $2 time ($3) --> CPU system time (avg1)
     *
     * @param  {Object} item Zabbix item object
     * @return {string}      expanded item name
     */
    function expandItemName(item) {
      var name = item.name;
      var key = item.key_;

      if (key) {
        // extract params from key:
        // "system.cpu.util[,system,avg1]" --> ["", "system", "avg1"]
        var key_params = key.substring(key.indexOf('[') + 1, key.lastIndexOf(']')).split(',');

        // replace item parameters
        for (var i = key_params.length; i >= 1; i--) {
          name = name.replace('$' + i, key_params[i - 1]);
        };
      }
      return name;
    };


    //////////////////////////////
    // VALIDATION
    //////////////////////////////

    function validateTarget(target) {
      var errs = {};

      return errs;
    }

  });

});
