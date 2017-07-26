'use strict';

System.register(['angular', 'lodash'], function (_export, _context) {
  "use strict";

  var angular, _, _createClass;

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  // Use factory() instead service() for multiple datasources support.
  // Each datasource instance must initialize its own cache.

  /** @ngInject */
  function ZabbixCachingProxyFactory() {
    var ZabbixCachingProxy = function () {
      function ZabbixCachingProxy(zabbixAPI, zabbixDBConnector, cacheOptions) {
        _classCallCheck(this, ZabbixCachingProxy);

        this.zabbixAPI = zabbixAPI;
        this.dbConnector = zabbixDBConnector;
        this.cacheEnabled = cacheOptions.enabled;
        this.ttl = cacheOptions.ttl || 600000; // 10 minutes by default

        // Internal objects for data storing
        this.cache = {
          groups: {},
          hosts: {},
          applications: {},
          items: {},
          history: {},
          trends: {},
          macros: {},
          globalMacros: {},
          itServices: {}
        };

        this.historyPromises = {};

        // Don't run duplicated history requests
        this.getHistory = callAPIRequestOnce(_.bind(this.zabbixAPI.getHistory, this.zabbixAPI), this.historyPromises, getHistoryRequestHash);

        if (this.dbConnector) {
          this.getHistoryDB = callAPIRequestOnce(_.bind(this.dbConnector.getHistory, this.dbConnector), this.historyPromises, getDBQueryHash);
          this.getTrendsDB = callAPIRequestOnce(_.bind(this.dbConnector.getTrends, this.dbConnector), this.historyPromises, getDBQueryHash);
        }

        // Don't run duplicated requests
        this.groupPromises = {};
        this.getGroupsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getGroups, this.zabbixAPI), this.groupPromises, getRequestHash);

        this.hostPromises = {};
        this.getHostsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getHosts, this.zabbixAPI), this.hostPromises, getRequestHash);

        this.appPromises = {};
        this.getAppsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getApps, this.zabbixAPI), this.appPromises, getRequestHash);

        this.itemPromises = {};
        this.getItemsOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getItems, this.zabbixAPI), this.itemPromises, getRequestHash);

        this.itemByIdPromises = {};
        this.getItemsByIdOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getItemsByIDs, this.zabbixAPI), this.itemPromises, getRequestHash);

        this.itServicesPromises = {};
        this.getITServicesOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getITService, this.zabbixAPI), this.itServicesPromises, getRequestHash);

        this.macroPromises = {};
        this.getMacrosOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getMacros, this.zabbixAPI), this.macroPromises, getRequestHash);

        this.globalMacroPromises = {};
        this.getGlobalMacrosOnce = callAPIRequestOnce(_.bind(this.zabbixAPI.getGlobalMacros, this.zabbixAPI), this.globalMacroPromises, getRequestHash);
      }

      _createClass(ZabbixCachingProxy, [{
        key: 'isExpired',
        value: function isExpired(cacheObject) {
          if (cacheObject) {
            var object_age = Date.now() - cacheObject.timestamp;
            return !(cacheObject.timestamp && object_age < this.ttl);
          } else {
            return true;
          }
        }
      }, {
        key: 'proxyRequest',
        value: function proxyRequest(request, params, cacheObject) {
          var hash = getRequestHash(params);
          if (this.cacheEnabled && !this.isExpired(cacheObject[hash])) {
            return Promise.resolve(cacheObject[hash].value);
          } else {
            return request.apply(undefined, _toConsumableArray(params)).then(function (result) {
              cacheObject[hash] = {
                value: result,
                timestamp: Date.now()
              };
              return result;
            });
          }
        }
      }, {
        key: 'getGroups',
        value: function getGroups() {
          return this.proxyRequest(this.getGroupsOnce, [], this.cache.groups);
        }
      }, {
        key: 'getHosts',
        value: function getHosts(groupids) {
          return this.proxyRequest(this.getHostsOnce, [groupids], this.cache.hosts);
        }
      }, {
        key: 'getApps',
        value: function getApps(hostids) {
          return this.proxyRequest(this.getAppsOnce, [hostids], this.cache.applications);
        }
      }, {
        key: 'getItems',
        value: function getItems(hostids, appids, itemtype) {
          var params = [hostids, appids, itemtype];
          return this.proxyRequest(this.getItemsOnce, params, this.cache.items);
        }
      }, {
        key: 'getItemsByIDs',
        value: function getItemsByIDs(itemids) {
          var params = [itemids];
          return this.proxyRequest(this.getItemsByIdOnce, params, this.cache.items);
        }
      }, {
        key: 'getITServices',
        value: function getITServices() {
          return this.proxyRequest(this.getITServicesOnce, [], this.cache.itServices);
        }
      }, {
        key: 'getMacros',
        value: function getMacros(hostids) {
          // Merge global macros and host macros
          var promises = [this.proxyRequest(this.getMacrosOnce, [hostids], this.cache.macros), this.proxyRequest(this.getGlobalMacrosOnce, [], this.cache.globalMacros)];

          return Promise.all(promises).then(_.flatten);
        }
      }, {
        key: 'getHistoryFromCache',
        value: function getHistoryFromCache(items, time_from, time_till) {
          var historyStorage = this.cache.history;
          var full_history;
          var expired = _.filter(_.keyBy(items, 'itemid'), function (item, itemid) {
            return !historyStorage[itemid];
          });
          if (expired.length) {
            return this.zabbixAPI.getHistory(expired, time_from, time_till).then(function (history) {
              var grouped_history = _.groupBy(history, 'itemid');
              _.forEach(expired, function (item) {
                var itemid = item.itemid;
                historyStorage[itemid] = item;
                historyStorage[itemid].time_from = time_from;
                historyStorage[itemid].time_till = time_till;
                historyStorage[itemid].history = grouped_history[itemid];
              });
              full_history = _.map(items, function (item) {
                return historyStorage[item.itemid].history;
              });
              return _.flatten(full_history, true);
            });
          } else {
            full_history = _.map(items, function (item) {
              return historyStorage[item.itemid].history;
            });
            return Promise.resolve(_.flatten(full_history, true));
          }
        }
      }, {
        key: 'getHistoryFromAPI',
        value: function getHistoryFromAPI(items, time_from, time_till) {
          return this.zabbixAPI.getHistory(items, time_from, time_till);
        }
      }]);

      return ZabbixCachingProxy;
    }();

    return ZabbixCachingProxy;
  }

  /**
   * Wrap zabbix API request to prevent multiple calls
   * with same params when waiting for result.
   */
  function callAPIRequestOnce(func, promiseKeeper, argsHashFunc) {
    return function () {
      var hash = argsHashFunc(arguments);
      if (!promiseKeeper[hash]) {
        promiseKeeper[hash] = Promise.resolve(func.apply(this, arguments).then(function (result) {
          promiseKeeper[hash] = null;
          return result;
        }));
      }
      return promiseKeeper[hash];
    };
  }

  function getRequestHash(args) {
    var requestStamp = _.map(args, function (arg) {
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
    var itemids = _.map(args[0], 'itemid');
    var stamp = itemids.join() + args[1] + args[2];
    return stamp.getHash();
  }

  function getDBQueryHash(args) {
    var itemids = _.map(args[0], 'itemid');
    var consolidateBy = args[3].consolidateBy;
    var intervalMs = args[3].intervalMs;
    var stamp = itemids.join() + args[1] + args[2] + consolidateBy + intervalMs;
    return stamp.getHash();
  }

  return {
    setters: [function (_angular) {
      angular = _angular.default;
    }, function (_lodash) {
      _ = _lodash.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      angular.module('grafana.services').factory('ZabbixCachingProxy', ZabbixCachingProxyFactory);String.prototype.getHash = function () {
        var hash = 0,
            i,
            chr,
            len;
        if (this.length !== 0) {
          for (i = 0, len = this.length; i < len; i++) {
            chr = this.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
          }
        }
        return hash;
      };

      // Fix for backward compatibility with lodash 2.4
      if (!_.keyBy) {
        _.keyBy = _.indexBy;
      }
    }
  };
});
//# sourceMappingURL=zabbixCachingProxy.service.js.map
