define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');
  var targetLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  module.controller('ZabbixAPITargetCtrl', function($scope) {

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

      $scope.target.errors = validateTarget($scope.target);
    };

    $scope.targetBlur = function() {
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
      $scope.datasource.performHostGroupSuggestQuery().then(function (series) {
        $scope.metric.hostGroupList = series;
        if ($scope.target.hostGroup) {
          $scope.target.hostGroup = $scope.metric.hostGroupList.filter(function (item, index, array) {
            // Find selected host in metric.hostList
            return (item.groupid == $scope.target.hostGroup.groupid);
          }).pop();
        }
      });
    };


    /**
     * Update list of hosts
     */
    $scope.updateHostList = function(groupid) {
      $scope.datasource.performHostSuggestQuery(groupid).then(function (series) {
        $scope.metric.hostList = series;

        if ($scope.target.host) {
          $scope.target.host = $scope.metric.hostList.filter(function (item, index, array) {
            // Find selected host in metric.hostList
            return (item.hostid == $scope.target.host.hostid);
          }).pop();
        }
      });
    };


    /**
     * Update list of host applications
     */
    $scope.updateAppList = function(hostid) {
      $scope.datasource.performAppSuggestQuery(hostid).then(function (series) {
        $scope.metric.applicationList = series;
        if ($scope.target.application) {
          $scope.target.application = $scope.metric.applicationList.filter(function (item, index, array) {
            // Find selected application in metric.hostList
            return (item.applicationid == $scope.target.application.applicationid);
          }).pop();
        }
      });
    };


    /**
     * Update list of items
     */
    $scope.updateItemList = function(hostid, applicationid) {

      // Update only if host selected
      if (hostid) {
        $scope.datasource.performItemSuggestQuery(hostid, applicationid).then(function (series) {
          $scope.metric.itemList = series;

          // Expand item parameters
          $scope.metric.itemList.forEach(function (item, index, array) {
            if (item && item.key_ && item.name) {
              item.expandedName = expandItemName(item);
            }
          });
          if ($scope.target.item) {
            $scope.target.item = $scope.metric.itemList.filter(function (item, index, array) {
              // Find selected item in metric.hostList
              return (item.itemid == $scope.target.item.itemid);
            }).pop();
          }
        });
      } else {
        $scope.metric.itemList = [];
      }
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
