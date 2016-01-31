define([
  'angular',
  'lodash',
  './utils'
],
function (angular, _, utils) {
  'use strict';

  var module = angular.module('grafana.services');

  // Use factory() instead service() for multiple datasources support.
  // Each datasource instance must initialize its own cache.
  module.factory('ZabbixCachingProxy', function($q) {

    function ZabbixCachingProxy(zabbixAPI, ttl) {
      this.zabbixAPI = zabbixAPI;
      this.ttl = ttl;

      // Internal objects for data storing
      this._groups        = undefined;
      this._hosts         = undefined;
      this._applications  = undefined;
      this._items         = undefined;

      // Check is a service initialized or not
      this._initialized = undefined;

      this.refreshPromise = false;
    }

    var p = ZabbixCachingProxy.prototype;

    /**
     * Wrap _refresh() method to call it once.
     */
    p.refresh = function() {
      var self = this;
      var deferred  = $q.defer();
      if (!self.refreshPromise) {
        self.refreshPromise = deferred.promise;
        self._refresh().then(function() {
          deferred.resolve();
          self.refreshPromise = null;
        });
      } else {
        return self.refreshPromise;
      }
      return deferred.promise;
    };

    p._refresh = function() {
      var self = this;
      var promises = [
        this.zabbixAPI.getGroups(),
        this.zabbixAPI.getHosts(),
        this.zabbixAPI.getApplications(),
        this.zabbixAPI.getItems()
      ];

      return $q.all(promises).then(function (results) {
        if (results.length) {
          self._groups        = results[0];
          self._hosts         = convertHosts(results[1]);
          self._applications  = convertApplications(results[2]);
          self._items         = convertItems(results[3]);
        }
        self._initialized = true;
      });
    };

    p.getGroups = function() {
      return this._groups;
    };

    p.getHosts = function() {
      return this._hosts;
    };

    p.getApplications = function() {
      return this._applications;
    };

    p.getItems = function(type) {
      switch (type) {
        case 'num':
          return _.filter(this._items, function(item) {
            return (item.value_type === '0' ||
                    item.value_type === '3');
          });
        case 'text':
          return _.filter(this._items, function(item) {
            return (item.value_type === '1' ||
                    item.value_type === '2' ||
                    item.value_type === '4');
          });
        default:
          return this._items;
      }
    };

    p.getHost = function(hostid) {
      return _.find(this._hosts, {'hostid': hostid});
    };

    p.getItem = function(itemid) {
      return _.find(this._items, {'itemid': itemid});
    };

    /**
     * Convert host.get response to cache format
     * host.groups - array of group ids
     */
    function convertHosts(hosts) {
      return _.forEach(hosts, function(host) {
        host.groups = _.map(host.groups, 'groupid');
        return host;
      });
    }

    /**
     * Group Zabbix applications by name
     * host.hosts - array of host ids
     */
    function convertApplications(applications) {
      return _.map(_.groupBy(applications, 'name'), function (value, key) {
        return {
          name: key,
          applicationids: _.map(value, 'applicationid'),
          hosts: _.uniq(_.map(_.flatten(value, 'hosts'), 'hostid'))
        };
      });
    }

    /**
     * Convert item.get response to cache format
     * item.applications - array of application ids
     * item.item - original item name returned by api (ie "CPU $2 time")
     * item.name - expanded name (ie "CPU system time")
     */
    function convertItems(items) {
      return _.forEach(items, function(item) {
        item.applications = _.map(item.applications, 'applicationid');
        item.item = item.name;
        item.name = utils.expandItemName(item.item, item.key_);
        return item;
      });
    }

    return ZabbixCachingProxy;

  });

});
