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
  module.factory('ZabbixCachingProxy', function($q, $interval) {

    function ZabbixCachingProxy(zabbixAPI, ttl) {
      this.zabbixAPI = zabbixAPI;
      this.ttl = ttl;

      // Internal objects for data storing
      this._groups        = undefined;
      this._hosts         = undefined;
      this._applications  = undefined;
      this._items         = undefined;
      this._hostsExtend   = undefined;
      this.storage = {
        history: {},
        trends: {}
      };

      // Check is a service initialized or not
      this._initialized = undefined;

      this.refreshPromise = false;
      this.historyPromises = {};

      // Wrap _refresh() method to call it once.
      this.refresh = callOnce(p._refresh, this.refreshPromise);

      // Update cache periodically
      $interval(_.bind(this.refresh, this), this.ttl);

      // Don't run duplicated history requests
      this.getHistory = callHistoryOnce(_.bind(this.zabbixAPI.getHistory, this.zabbixAPI),
                                        this.historyPromises);
    }

    var p = ZabbixCachingProxy.prototype;

    p._refresh = function() {
      var self = this;
      var promises = [
        this.zabbixAPI.getGroups(),
        this.zabbixAPI.getHosts(),
        this.zabbixAPI.getApplications(),
        this.zabbixAPI.getItems(),
        this.zabbixAPI.getHostsExtend()
      ];

      return $q.all(promises).then(function(results) {
        if (results.length) {
          self._groups        = convertGroups(results[0]);
          self._hosts         = convertHosts(results[1]);
          self._applications  = convertApplications(results[2]);
          self._items         = convertItems(results[3]);
          self._hostsExtend   = convertHostsExtend(results[4]);
        }
        self._initialized = true;
      });
    };

    p.getGroups = function() {
      var self = this;
      if (this._groups) {
        return $q.when(self._groups);
      } else {
        return this.refresh().then(function() {
          return self._groups;
        });
      }
    };

    p.getHosts = function() {
      var self = this;
      if (this._hosts) {
        return $q.when(self._hosts);
      } else {
        return this.refresh().then(function() {
          return self._hosts;
        });
      }
    };

    p.getHostsExtend = function() {
      var self = this;
      if (this._hostsExtend) {
        return $q.when(self._hostsExtend);
      } else {
        return this.refresh().then(function() {
          return self._hostsExtend;
        });
      }
    };

    p.getApplications = function() {
      var self = this;
      if (this._applications) {
        return $q.when(self._applications);
      } else {
        return this.refresh().then(function() {
          return self._applications;
        });
      }
    };

    p.getItems = function(type) {
      var self = this;
      if (this._items) {
        return $q.when(filterItems(self._items, type));
      } else {
        return this.refresh().then(function() {
          return filterItems(self._items, type);
        });
      }
    };

    function filterItems(items, type) {
      switch (type) {
        case 'num':
          return _.filter(items, function(item) {
            return (item.value_type === '0' ||
                    item.value_type === '3');
          });
        case 'text':
          return _.filter(items, function(item) {
            return (item.value_type === '1' ||
                    item.value_type === '2' ||
                    item.value_type === '4');
          });
        default:
          return items;
      }
    }

    p.getHistoryFromCache = function(items, time_from, time_till) {
      var deferred  = $q.defer();
      var historyStorage = this.storage.history;
      var full_history;
      var expired = _.filter(_.indexBy(items, 'itemid'), function(item, itemid) {
        return !historyStorage[itemid];
      });
      if (expired.length) {
        this.zabbixAPI.getHistory(expired, time_from, time_till).then(function(history) {
          var grouped_history = _.groupBy(history, 'itemid');
          _.forEach(expired, function(item) {
            var itemid = item.itemid;
            historyStorage[itemid] = item;
            historyStorage[itemid].time_from = time_from;
            historyStorage[itemid].time_till = time_till;
            historyStorage[itemid].history = grouped_history[itemid];
          });
          full_history = _.map(items, function(item) {
            return historyStorage[item.itemid].history;
          });
          deferred.resolve(_.flatten(full_history, true));
        });
      } else {
        full_history = _.map(items, function(item) {
          return historyStorage[item.itemid].history;
        });
        deferred.resolve(_.flatten(full_history, true));
      }
      return deferred.promise;
    };

    p.getHistoryFromAPI = function(items, time_from, time_till) {
      return this.zabbixAPI.getHistory(items, time_from, time_till);
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

    function convertGroups(groups) {
      return _.forEach(groups, function(group) {
        group.hosts = _.map(group.hosts, 'hostid');
        return group;
      });
    }

    function convertHostsExtend(hosts) {
      return _.indexBy(_.map(hosts, function(host) {
        host.items = _.forEach(host.items, function(item) {
          item.applications = _.map(item.applications, 'applicationid');
          item.item = item.name;
          item.name = utils.expandItemName(item.item, item.key_);
          return item;
        });
        return host;
      }), 'hostid');
    }

    /**
     * Group Zabbix applications by name
     * host.hosts - array of host ids
     */
    function convertApplications(applications) {
      return _.map(_.groupBy(applications, 'name'), function(value, key) {

        // Hack for supporting different apis (2.2 vs 2.4 vs 3.0)
        var hostField = 'host';
        if (value[0] && value[0]['hosts']) {
          // For Zabbix 2.2
          hostField = 'hosts';
        }

        return {
          name: key,
          applicationids: _.map(value, 'applicationid'),
          hosts: _.uniq(_.map(_.flatten(value, hostField), 'hostid'))
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

    String.prototype.getHash = function() {
      var hash = 0, i, chr, len;
      if (this.length === 0) {
        return hash;
      }
      for (i = 0, len = this.length; i < len; i++) {
        chr   = this.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
      }
      return hash;
    };

    function callHistoryOnce(func, promiseKeeper) {
      return function() {
        var itemids = _.map(arguments[0], 'itemid');
        var stamp = itemids.join() + arguments[1] + arguments[2];
        var hash = stamp.getHash();

        var deferred  = $q.defer();
        if (!promiseKeeper[hash]) {
          promiseKeeper[hash] = deferred.promise;
          func.apply(this, arguments).then(function(result) {
            deferred.resolve(result);
            promiseKeeper[hash] = null;
          });
        } else {
          return promiseKeeper[hash];
        }
        return deferred.promise;
      };
    }

    function callOnce(func, promiseKeeper) {
      return function() {
        var deferred  = $q.defer();
        if (!promiseKeeper) {
          promiseKeeper = deferred.promise;
          func.apply(this, arguments).then(function(result) {
            deferred.resolve(result);
            promiseKeeper = null;
          });
        } else {
          return promiseKeeper;
        }
        return deferred.promise;
      };
    }

    return ZabbixCachingProxy;

  });

});
