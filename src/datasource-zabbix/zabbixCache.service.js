import angular from 'angular';
import _ from 'lodash';

// Use factory() instead service() for multiple datasources support.
// Each datasource instance must initialize its own cache.

/** @ngInject */
function ZabbixCachingProxyFactory($q, $interval) {

  class ZabbixCachingProxy {
    constructor(zabbixAPI, ttl) {
      this.zabbixAPI = zabbixAPI;
      this.ttl = ttl;

      this.$q = $q;

      // Internal objects for data storing
      this._groups        = undefined;
      this._hosts         = undefined;
      this._applications  = undefined;
      this._items         = undefined;
      this.storage = {
        history: {},
        trends: {}
      };

      // Check is a service initialized or not
      this._initialized = undefined;

      this.refreshPromise = false;
      this.historyPromises = {};

      // Wrap _refresh() method to call it once.
      this.refresh = callOnce(this._refresh, this.refreshPromise);

      // Update cache periodically
      $interval(_.bind(this.refresh, this), this.ttl);

      // Don't run duplicated history requests
      this.getHistory = callAPIRequestOnce(_.bind(this.zabbixAPI.getHistory, this.zabbixAPI),
                                           this.historyPromises, getHistoryRequestHash);

      // Don't run duplicated requests
      this.groupPromises = {};
      this.getGroupsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getGroups, this.zabbixAPI),
                                              this.groupPromises, getAPIRequestHash);

      this.hostPromises = {};
      this.getHostsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getHosts, this.zabbixAPI),
                                             this.hostPromises, getAPIRequestHash);

      this.appPromises = {};
      this.getAppsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getApps, this.zabbixAPI),
                                            this.appPromises, getAPIRequestHash);

      this.itemPromises = {};
      this.getItemsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getItems, this.zabbixAPI),
                                             this.itemPromises, getAPIRequestHash);
    }

    _refresh() {
      let promises = [
        this.zabbixAPI.getGroups()
      ];

      return Promise.all(promises)
      .then(results => {
        if (results.length) {
          this._groups = results[0];
        }
        this._initialized = true;
      });
    }

    getGroups() {
      if (this._groups) {
        return Promise.resolve(this._groups);
      } else {
        return this.getGroupsOnce()
        .then(groups => {
          this._groups = groups;
          return groups;
        });
      }
    }

    getHosts(groupids) {
      return this.getHostsOnce(groupids)
      .then(hosts => {
        // iss #196 - disable caching due performance issues
        //this._hosts = _.union(this._hosts, hosts);
        return hosts;
      });
    }

    getApps(hostids) {
      return this.getAppsOnce(hostids)
      .then(apps => {
        return apps;
      });
    }

    getItems(hostids, appids, itemtype) {
      return this.getItemsOnce(hostids, appids, itemtype)
      .then(items => {
        // iss #196 - disable caching due performance issues
        //this._items = _.union(this._items, items);
        return items;
      });
    }

    getHistoryFromCache(items, time_from, time_till) {
      var deferred  = this.$q.defer();
      var historyStorage = this.storage.history;
      var full_history;
      var expired = _.filter(_.keyBy(items, 'itemid'), function(item, itemid) {
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
    }

    getHistoryFromAPI(items, time_from, time_till) {
      return this.zabbixAPI.getHistory(items, time_from, time_till);
    }

    getHost(hostid) {
      return _.find(this._hosts, {'hostid': hostid});
    }

    getItem(itemid) {
      return _.find(this._items, {'itemid': itemid});
    }
  }

  return ZabbixCachingProxy;
}

angular
  .module('grafana.services')
  .factory('ZabbixCachingProxy', ZabbixCachingProxyFactory);

/**
 * Wrap function to prevent multiple calls
 * when waiting for result.
 */
function callOnce(func, promiseKeeper) {
  return function() {
    if (!promiseKeeper) {
      promiseKeeper = Promise.resolve(
        func.apply(this, arguments)
        .then(result => {
          promiseKeeper = null;
          return result;
        })
      );
    }
    return promiseKeeper;
  };
}

/**
 * Wrap zabbix API request to prevent multiple calls
 * with same params when waiting for result.
 */
function callAPIRequestOnce(func, promiseKeeper, argsHashFunc) {
  return function() {
    var hash = argsHashFunc(arguments);
    if (!promiseKeeper[hash]) {
      promiseKeeper[hash] = Promise.resolve(
        func.apply(this, arguments)
        .then(result => {
          promiseKeeper[hash] = null;
          return result;
        })
      );
    }
    return promiseKeeper[hash];
  };
}

function getAPIRequestHash(args) {
  var requestStamp = _.map(args, arg => {
    if (arg === undefined) {
      return 'undefined';
    } else {
      return arg.toString();
    }
  }).join();
  return requestStamp.getHash();
}

function getHistoryRequestHash(args) {
  let itemids = _.map(args[0], 'itemid');
  let stamp = itemids.join() + args[1] + args[2];
  return stamp.getHash();
}

String.prototype.getHash = function() {
  var hash = 0, i, chr, len;
  if (this.length !== 0) {
    for (i = 0, len = this.length; i < len; i++) {
      chr   = this.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
  }
  return hash;
};

// Fix for backward compatibility with lodash 2.4
if (!_.keyBy) {_.keyBy = _.indexBy;}
