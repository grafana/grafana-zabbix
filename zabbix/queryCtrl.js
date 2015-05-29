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
      $scope.updateHostGroupList();
      if ($scope.target.hostGroup) {
        $scope.updateHostList($scope.target.hostGroup.groupid);
      } else {
        $scope.updateHostList();
      }
      if ($scope.target.host) {
        $scope.updateAppList($scope.target.host.hostid);
        if ($scope.target.application) {
          $scope.updateItemList($scope.target.host.hostid, $scope.target.application.applicationid);
        } else {
          $scope.updateItemList($scope.target.host.hostid, null);
        }
      }

      setItemAlias();

      $scope.target.errors = validateTarget($scope.target);
    };

    // Take alias from item name by default
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

    // Call when host group selected
    $scope.selectHostGroup = function() {

      // Update host list
      if ($scope.target.hostGroup) {
        $scope.updateHostList($scope.target.hostGroup.groupid);
      } else {
        $scope.updateHostList('');
      }

      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    // Call when host selected
    $scope.selectHost = function() {
      if ($scope.target.host) {
        // Update item list
        if ($scope.target.application) {
          $scope.updateItemList($scope.target.host.hostid, $scope.target.application.applicationid);
        } else {
          $scope.updateItemList($scope.target.host.hostid, null);
        }

        // Update application list
        $scope.updateAppList($scope.target.host.hostid);
      }

      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };


    // Call when application selected
    $scope.selectApplication = function() {

      // Update item list
      if ($scope.target.application) {
        $scope.updateItemList($scope.target.host.hostid, $scope.target.application.applicationid);
      } else {
        $scope.updateItemList($scope.target.host.hostid, null);
      }

      $scope.target.errors = validateTarget($scope.target);
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };


    // Call when item selected
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
    $scope.updateHostGroupList = function() {
      $scope.metric.hostGroupList = [];
      addTemplatedVariables($scope.metric.hostGroupList);

      $scope.datasource.performHostGroupSuggestQuery().then(function (series) {
        $scope.metric.hostGroupList = $scope.metric.hostGroupList.concat(series);

        if ($scope.target.hostGroup) {
          $scope.target.hostGroup = $scope.metric.hostGroupList.filter(function (item, index, array) {
            // Find selected host in metric.hostList
            return item.name == $scope.target.hostGroup.name;
          }).pop();
        }
      });
    };


    /**
     * Update list of hosts
     */
    $scope.updateHostList = function(groupid) {
      $scope.metric.hostList = [];
      addTemplatedVariables($scope.metric.hostList);

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
    $scope.updateAppList = function(hostid) {
      $scope.metric.applicationList = [];
      addTemplatedVariables($scope.metric.applicationList);

      $scope.datasource.performAppSuggestQuery(hostid).then(function (series) {
        $scope.metric.applicationList = $scope.metric.applicationList.concat(series);

        if ($scope.target.application) {
          $scope.target.application = $scope.metric.applicationList.filter(function (item, index, array) {
            // Find selected application in metric.hostList
            return item.name == $scope.target.application.name;
          }).pop();
        }
      });
    };


    /**
     * Update list of items
     */
    $scope.updateItemList = function(hostid, applicationid) {
      $scope.metric.itemList = [];
      addTemplatedVariables($scope.metric.itemList);

      // Update only if host selected
      if (hostid) {
        $scope.datasource.performItemSuggestQuery(hostid, applicationid).then(function (series) {
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
      } else {
        if ($scope.target.item) {
          $scope.target.item = $scope.metric.itemList.filter(function (item, index, array) {
            // Find selected item in metric.hostList
            return (item.name == $scope.target.item.name);
          }).pop();
        }
      }
    };


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
     * @param item: zabbix api item object
     * @return: expanded item name (string)
     */
    function expandItemName(item) {
      var name = item.name;
      var key = item.key_;

      // extract params from key:
      // "system.cpu.util[,system,avg1]" --> ["", "system", "avg1"]
      var key_params = key.substring(key.indexOf('[') + 1, key.lastIndexOf(']')).split(',');

      // replace item parameters
      for (var i = key_params.length; i >= 1; i--) {
        name = name.replace('$' + i, key_params[i - 1]);
      };
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
