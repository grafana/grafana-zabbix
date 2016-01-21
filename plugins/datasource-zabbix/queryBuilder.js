define([
  'angular',
  'lodash',
  './zabbixCacheSrv',
  './utils'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('QueryBuilderSrv', function(ZabbixCache, Utils) {

    this.build = function (groupFilter, hostFilter, appFilter, itemFilter) {

      // Find items by item names and perform queries
      var groups = [];
      var hosts = [];
      var apps = [];
      var items = [];

      if (Utils.isRegex(hostFilter)) {

        // Filter groups
        if (Utils.isRegex(groupFilter)) {
          var groupPattern = Utils.buildRegex(groupFilter);
          groups = _.filter(ZabbixCache.getGroups(), function (groupObj) {
            return groupPattern.test(groupObj.name);
          });
        } else {
          var findedGroup = _.find(ZabbixCache.getGroups(), {'name': groupFilter});
          if (findedGroup) {
            groups.push(findedGroup);
          } else {
            groups = undefined;
          }
        }
        if (groups) {
          var groupids = _.map(groups, 'groupid');
          hosts = _.filter(ZabbixCache.getHosts(), function (hostObj) {
            return _.intersection(groupids, hostObj.groups).length;
          });
        } else {
          // No groups finded
          return [];
        }

        // Filter hosts
        var hostPattern = Utils.buildRegex(hostFilter);
        hosts = _.filter(hosts, function (hostObj) {
          return hostPattern.test(hostObj.name);
        });
      } else {
        var findedHost = _.find(ZabbixCache.getHosts(), {'name': hostFilter});
        if (findedHost) {
          hosts.push(findedHost);
        } else {
          // No hosts finded
          return [];
        }
      }

      // Find items belongs to selected hosts
      items = _.filter(ZabbixCache.getItems(), function (itemObj) {
        return _.contains(_.map(hosts, 'hostid'), itemObj.hostid);
      });

      if (Utils.isRegex(itemFilter)) {

        // Filter applications
        if (Utils.isRegex(appFilter)) {
          var appPattern = Utils.buildRegex(appFilter);
          apps = _.filter(ZabbixCache.getApplications(), function (appObj) {
            return appPattern.test(appObj.name);
          });
        }
        // Don't use application filter if it empty
        else if (appFilter === "") {
          apps = undefined;
        }
        else {
          var findedApp = _.find(ZabbixCache.getApplications(), {'name': appFilter});
          if (findedApp) {
            apps.push(findedApp);
          } else {
            // No applications finded
            return [];
          }
        }

        // Find items belongs to selected applications
        if (apps) {
          var appids = _.flatten(_.map(apps, 'applicationids'));
          items = _.filter(items, function (itemObj) {
            return _.intersection(appids, itemObj.applications).length;
          });
        }

        if (items) {
          var itemPattern = Utils.buildRegex(itemFilter);
          items = _.filter(items, function (itemObj) {
            return itemPattern.test(itemObj.name);
          });
        } else {
          // No items finded
          return [];
        }
      } else {
        items = _.filter(items, {'name': hostFilter});
        if (!items.length) {
          // No items finded
          return [];
        }
      }

      // Set host as host name for each item
      items = _.each(items, function (itemObj) {
        itemObj.host = _.find(hosts, {'hostid': itemObj.hostid}).name;
      });

      // Use alias only for single metric, otherwise use item names
      var alias;
      if (items.length === 1) {
        alias = templateSrv.replace(alias, options.scopedVars);
      }

      var history;
      if ((from < useTrendsFrom) && self.trends) {
        // Use trends
        var points = downsampleFunction ? downsampleFunction.value : "avg";
        history = self.zabbixAPI.getTrends(items, from, to)
          .then(_.bind(zabbixHelperSrv.handleTrendResponse, zabbixHelperSrv, items, alias, scale, points));
      } else {
        // Use history
        history = self.zabbixAPI.getHistory(items, from, to)
          .then(_.bind(zabbixHelperSrv.handleHistoryResponse, zabbixHelperSrv, items, alias, scale));
      }

      return history.then(function (timeseries) {
        var timeseries_data = _.flatten(timeseries);
        return _.map(timeseries_data, function (timeseries) {

          // Series downsampling
          if (timeseries.datapoints.length > options.maxDataPoints) {
            var ms_interval = Math.floor((to - from) / options.maxDataPoints) * 1000;
            var downsampleFunc = downsampleFunction ? downsampleFunction.value : "avg";
            timeseries.datapoints = zabbixHelperSrv.downsampleSeries(timeseries.datapoints, to, ms_interval, downsampleFunc);
          }
          return timeseries;
        });
      });

      return itemFilter;
    };

  });
});