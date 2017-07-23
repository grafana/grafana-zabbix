'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _angular = require('angular');

var _angular2 = _interopRequireDefault(_angular);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

require('./zabbixAPI.service.js');

require('./zabbixCachingProxy.service.js');

require('./zabbixDBConnector');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Use factory() instead service() for multiple data sources support.
// Each Zabbix data source instance should initialize its own API instance.

/** @ngInject */
function ZabbixFactory(zabbixAPIService, ZabbixCachingProxy, ZabbixDBConnector) {
  var Zabbix = function () {
    function Zabbix(url, options) {
      _classCallCheck(this, Zabbix);

      var username = options.username,
          password = options.password,
          basicAuth = options.basicAuth,
          withCredentials = options.withCredentials,
          cacheTTL = options.cacheTTL,
          enableDirectDBConnection = options.enableDirectDBConnection,
          sqlDatasourceId = options.sqlDatasourceId;

      // Initialize Zabbix API

      var ZabbixAPI = zabbixAPIService;
      this.zabbixAPI = new ZabbixAPI(url, username, password, basicAuth, withCredentials);

      // Initialize caching proxy for requests
      var cacheOptions = {
        enabled: true,
        ttl: cacheTTL
      };
      this.cachingProxy = new ZabbixCachingProxy(this.zabbixAPI, cacheOptions);

      // Proxy methods
      this.getHistory = this.cachingProxy.getHistory.bind(this.cachingProxy);
      this.getMacros = this.cachingProxy.getMacros.bind(this.cachingProxy);

      this.getTrend = this.zabbixAPI.getTrend.bind(this.zabbixAPI);
      this.getEvents = this.zabbixAPI.getEvents.bind(this.zabbixAPI);
      this.getAlerts = this.zabbixAPI.getAlerts.bind(this.zabbixAPI);
      this.getAcknowledges = this.zabbixAPI.getAcknowledges.bind(this.zabbixAPI);
      this.getITService = this.zabbixAPI.getITService.bind(this.zabbixAPI);
      this.getSLA = this.zabbixAPI.getSLA.bind(this.zabbixAPI);
      this.getVersion = this.zabbixAPI.getVersion.bind(this.zabbixAPI);
      this.login = this.zabbixAPI.login.bind(this.zabbixAPI);

      if (enableDirectDBConnection) {
        this.dbConnector = new ZabbixDBConnector(sqlDatasourceId);
        this.getHistoryDB = this.dbConnector.getHistory.bind(this.dbConnector);
        this.getTrendsDB = this.dbConnector.getTrends.bind(this.dbConnector);
      }
    }

    _createClass(Zabbix, [{
      key: 'getItemsFromTarget',
      value: function getItemsFromTarget(target, options) {
        var parts = ['group', 'host', 'application', 'item'];
        var filters = _lodash2.default.map(parts, function (p) {
          return target[p].filter;
        });
        return this.getItems.apply(this, _toConsumableArray(filters).concat([options]));
      }
    }, {
      key: 'getAllGroups',
      value: function getAllGroups() {
        return this.cachingProxy.getGroups();
      }
    }, {
      key: 'getGroups',
      value: function getGroups(groupFilter) {
        return this.getAllGroups().then(function (groups) {
          return findByFilter(groups, groupFilter);
        });
      }

      /**
       * Get list of host belonging to given groups.
       */

    }, {
      key: 'getAllHosts',
      value: function getAllHosts(groupFilter) {
        var _this = this;

        return this.getGroups(groupFilter).then(function (groups) {
          var groupids = _lodash2.default.map(groups, 'groupid');
          return _this.cachingProxy.getHosts(groupids);
        });
      }
    }, {
      key: 'getHosts',
      value: function getHosts(groupFilter, hostFilter) {
        return this.getAllHosts(groupFilter).then(function (hosts) {
          return findByFilter(hosts, hostFilter);
        });
      }

      /**
       * Get list of applications belonging to given groups and hosts.
       */

    }, {
      key: 'getAllApps',
      value: function getAllApps(groupFilter, hostFilter) {
        var _this2 = this;

        return this.getHosts(groupFilter, hostFilter).then(function (hosts) {
          var hostids = _lodash2.default.map(hosts, 'hostid');
          return _this2.cachingProxy.getApps(hostids);
        });
      }
    }, {
      key: 'getApps',
      value: function getApps(groupFilter, hostFilter, appFilter) {
        var _this3 = this;

        return this.getHosts(groupFilter, hostFilter).then(function (hosts) {
          var hostids = _lodash2.default.map(hosts, 'hostid');
          if (appFilter) {
            return _this3.cachingProxy.getApps(hostids).then(function (apps) {
              return filterByQuery(apps, appFilter);
            });
          } else {
            return {
              appFilterEmpty: true,
              hostids: hostids
            };
          }
        });
      }
    }, {
      key: 'getAllItems',
      value: function getAllItems(groupFilter, hostFilter, appFilter) {
        var _this4 = this;

        var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

        return this.getApps(groupFilter, hostFilter, appFilter).then(function (apps) {
          if (apps.appFilterEmpty) {
            return _this4.cachingProxy.getItems(apps.hostids, undefined, options.itemtype);
          } else {
            var appids = _lodash2.default.map(apps, 'applicationid');
            return _this4.cachingProxy.getItems(undefined, appids, options.itemtype);
          }
        }).then(function (items) {
          if (!options.showDisabledItems) {
            items = _lodash2.default.filter(items, { 'status': '0' });
          }

          return items;
        }).then(this.expandUserMacro.bind(this));
      }
    }, {
      key: 'expandUserMacro',
      value: function expandUserMacro(items) {
        var hostids = getHostIds(items);
        return this.getMacros(hostids).then(function (macros) {
          _lodash2.default.forEach(items, function (item) {
            if (utils.containsMacro(item.name)) {
              item.name = utils.replaceMacro(item, macros);
            }
          });
          return items;
        });
      }
    }, {
      key: 'getItems',
      value: function getItems(groupFilter, hostFilter, appFilter, itemFilter) {
        var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

        return this.getAllItems(groupFilter, hostFilter, appFilter, options).then(function (items) {
          return filterByQuery(items, itemFilter);
        });
      }

      /**
       * Build query - convert target filters to array of Zabbix items
       */

    }, {
      key: 'getTriggers',
      value: function getTriggers(groupFilter, hostFilter, appFilter, options) {
        var _this5 = this;

        var promises = [this.getGroups(groupFilter), this.getHosts(groupFilter, hostFilter), this.getApps(groupFilter, hostFilter, appFilter)];

        return Promise.all(promises).then(function (results) {
          var filteredGroups = results[0];
          var filteredHosts = results[1];
          var filteredApps = results[2];
          var query = {};

          if (appFilter) {
            query.applicationids = _lodash2.default.flatten(_lodash2.default.map(filteredApps, 'applicationid'));
          }
          if (hostFilter) {
            query.hostids = _lodash2.default.map(filteredHosts, 'hostid');
          }
          if (groupFilter) {
            query.groupids = _lodash2.default.map(filteredGroups, 'groupid');
          }

          return query;
        }).then(function (query) {
          return _this5.zabbixAPI.getTriggers(query.groupids, query.hostids, query.applicationids, options);
        });
      }
    }]);

    return Zabbix;
  }();

  return Zabbix;
}

_angular2.default.module('grafana.services').factory('Zabbix', ZabbixFactory);

///////////////////////////////////////////////////////////////////////////////

/**
 * Find group, host, app or item by given name.
 * @param  list list of groups, apps or other
 * @param  name visible name
 * @return      array with finded element or empty array
 */
function findByName(list, name) {
  var finded = _lodash2.default.find(list, { 'name': name });
  if (finded) {
    return [finded];
  } else {
    return [];
  }
}

/**
 * Different hosts can contains applications and items with same name.
 * For this reason use _.filter, which return all elements instead _.find,
 * which return only first finded.
 * @param  {[type]} list list of elements
 * @param  {[type]} name app name
 * @return {[type]}      array with finded element or empty array
 */
function filterByName(list, name) {
  var finded = _lodash2.default.filter(list, { 'name': name });
  if (finded) {
    return finded;
  } else {
    return [];
  }
}

function filterByRegex(list, regex) {
  var filterPattern = utils.buildRegex(regex);
  return _lodash2.default.filter(list, function (zbx_obj) {
    return filterPattern.test(zbx_obj.name);
  });
}

function findByFilter(list, filter) {
  if (utils.isRegex(filter)) {
    return filterByRegex(list, filter);
  } else {
    return findByName(list, filter);
  }
}

function filterByQuery(list, filter) {
  if (utils.isRegex(filter)) {
    return filterByRegex(list, filter);
  } else {
    return filterByName(list, filter);
  }
}

function getHostIds(items) {
  var hostIds = _lodash2.default.map(items, function (item) {
    return _lodash2.default.map(item.hosts, 'hostid');
  });
  return _lodash2.default.uniq(_lodash2.default.flatten(hostIds));
}
