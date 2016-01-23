define([
  'angular',
  'lodash',
  './utils'
],
function (angular, _, utils) {
  'use strict';

  function QueryBuilder(zabbixCacheInstance) {

    this.cache = zabbixCacheInstance;

    this.build = function (groupFilter, hostFilter, appFilter, itemFilter) {

      // Find items by item names and perform queries
      var groups = [];
      var hosts = [];
      var apps = [];
      var items = [];

      if (utils.isRegex(hostFilter)) {

        // Filter groups
        if (utils.isRegex(groupFilter)) {
          var groupPattern = utils.buildRegex(groupFilter);
          groups = _.filter(this.cache.getGroups(), function (groupObj) {
            return groupPattern.test(groupObj.name);
          });
        } else {
          var findedGroup = _.find(this.cache.getGroups(), {'name': groupFilter});
          if (findedGroup) {
            groups.push(findedGroup);
          } else {
            groups = undefined;
          }
        }
        if (groups) {
          var groupids = _.map(groups, 'groupid');
          hosts = _.filter(this.cache.getHosts(), function (hostObj) {
            return _.intersection(groupids, hostObj.groups).length;
          });
        } else {
          // No groups finded
          return [];
        }

        // Filter hosts
        var hostPattern = utils.buildRegex(hostFilter);
        hosts = _.filter(hosts, function (hostObj) {
          return hostPattern.test(hostObj.name);
        });
      } else {
        var findedHost = _.find(this.cache.getHosts(), {'name': hostFilter});
        if (findedHost) {
          hosts.push(findedHost);
        } else {
          // No hosts finded
          return [];
        }
      }

      // Find items belongs to selected hosts
      items = _.filter(this.cache.getItems(), function (itemObj) {
        return _.contains(_.map(hosts, 'hostid'), itemObj.hostid);
      });

      if (utils.isRegex(itemFilter)) {

        // Filter applications
        if (utils.isRegex(appFilter)) {
          var appPattern = utils.buildRegex(appFilter);
          apps = _.filter(this.cache.getApplications(), function (appObj) {
            return appPattern.test(appObj.name);
          });
        }
        // Don't use application filter if it empty
        else if (appFilter === "") {
          apps = undefined;
        }
        else {
          var findedApp = _.find(this.cache.getApplications(), {'name': appFilter});
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
          var itemPattern = utils.buildRegex(itemFilter);
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

      return items;
    };

  }

  return QueryBuilder;

});