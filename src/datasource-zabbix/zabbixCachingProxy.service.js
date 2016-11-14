import angular from 'angular';
import _ from 'lodash';

// Use factory() instead service() for multiple datasources support.
// Each datasource instance must initialize its own cache.

/** @ngInject */
function ZabbixCachingProxyFactory() {

  class ZabbixCachingProxy {
    constructor(zabbixAPI, cacheOptions) {
      this.zabbixAPI = zabbixAPI;
      this.cacheEnabled = cacheOptions.enabled;
      this.ttl          = cacheOptions.ttl || 600000; // 10 minutes by default

      // Internal objects for data storing
      this._groups        = undefined;
      this._hosts         = undefined;
      this._applications  = undefined;
      this._items         = undefined;
      this.storage = {
        history: {},
        trends: {}
      };

      this.cache = {
        groups: {},
        hosts: {},
        applications: {},
        items: {}
      };

      // Check is a service initialized or not
      this._initialized = undefined;

      this.refreshPromise = false;
      this.historyPromises = {};

      // Wrap _refresh() method to call it once.
      this.refresh = callOnce(this._refresh, this.refreshPromise);

      // Update cache periodically
      // $interval(_.bind(this.refresh, this), this.ttl);

      // Don't run duplicated history requests
      this.getHistory = callAPIRequestOnce(_.bind(this.zabbixAPI.getHistory, this.zabbixAPI),
                                           this.historyPromises, getHistoryRequestHash);

      // Don't run duplicated requests
      this.groupPromises = {};
      this.getGroupsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getGroups, this.zabbixAPI),
                                              this.groupPromises, getRequestHash);

      this.hostPromises = {};
      this.getHostsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getHosts, this.zabbixAPI),
                                             this.hostPromises, getRequestHash);

      this.appPromises = {};
      this.getAppsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getApps, this.zabbixAPI),
                                            this.appPromises, getRequestHash);

      this.itemPromises = {};
      this.getItemsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getItems, this.zabbixAPI),
                                             this.itemPromises, getRequestHash);
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

    isExpired(cacheObject) {
      if (cacheObject) {
        let object_age = Date.now() - cacheObject.timestamp;
        return !(cacheObject.timestamp && object_age < this.ttl);
      } else {
        return true;
      }
    }

    /**
     * Check that result is present in cache and up to date
     * or send request to API.
     */
    proxyRequest(request, params, cacheObject) {
      let hash = getRequestHash(params);
      if (this.cacheEnabled && !this.isExpired(cacheObject[hash])) {
        return Promise.resolve(cacheObject[hash].value);
      } else {
        return request(...params)
        .then(result => {
          cacheObject[hash] = {
            value: result,
            timestamp: Date.now()
          };
          return result;
        });
      }
    }

    getGroups() {
      return this.proxyRequest(this.getGroupsOnce, [], this.cache.groups);
    }

    getHosts(groupids) {
      return this.proxyRequest(this.getHostsOnce, [groupids], this.cache.hosts);
    }

    getApps(hostids) {
      return this.proxyRequest(this.getAppsOnce, [hostids], this.cache.applications);
    }

    getItems(hostids, appids, itemtype) {
      let params = [hostids, appids, itemtype];
      return this.proxyRequest(this.getItemsOnce, params, this.cache.items);
    }

    getHistoryFromCache(items, time_from, time_till) {
      var historyStorage = this.storage.history;
      var full_history;
      var expired = _.filter(_.keyBy(items, 'itemid'), (item, itemid) => {
        return !historyStorage[itemid];
      });
      if (expired.length) {
        return this.zabbixAPI.getHistory(expired, time_from, time_till).then(function(history) {
          var grouped_history = _.groupBy(history, 'itemid');
          _.forEach(expired, item => {
            var itemid = item.itemid;
            historyStorage[itemid] = item;
            historyStorage[itemid].time_from = time_from;
            historyStorage[itemid].time_till = time_till;
            historyStorage[itemid].history = grouped_history[itemid];
          });
          full_history = _.map(items, item => {
            return historyStorage[item.itemid].history;
          });
          return _.flatten(full_history, true);
        });
      } else {
        full_history = _.map(items, function(item) {
          return historyStorage[item.itemid].history;
        });
        return Promise.resolve(_.flatten(full_history, true));
      }
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

function getRequestHash(args) {
  var requestStamp = _.map(args, arg => {
    if (arg === undefined) {
      return 'undefined';
    } else {
      if (_.isArray(arg)) {
        return arg.sort().toString();
      } else {
        return arg.toString();
      }
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
