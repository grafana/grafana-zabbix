'use strict';

System.register(['angular', 'lodash', './utils', './zabbixAPI.service.js', './zabbixCachingProxy.service.js', './zabbixDBConnector'], function (_export, _context) {
  "use strict";

  var angular, _, utils, _slicedToArray, _createClass;

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

        if (enableDirectDBConnection) {
          this.dbConnector = new ZabbixDBConnector(sqlDatasourceId);
        }

        // Initialize caching proxy for requests
        var cacheOptions = {
          enabled: true,
          ttl: cacheTTL
        };
        this.cachingProxy = new ZabbixCachingProxy(this.zabbixAPI, this.dbConnector, cacheOptions);

        // Proxy methods
        this.getHistory = this.cachingProxy.getHistory.bind(this.cachingProxy);
        this.getMacros = this.cachingProxy.getMacros.bind(this.cachingProxy);
        this.getItemsByIDs = this.cachingProxy.getItemsByIDs.bind(this.cachingProxy);

        if (enableDirectDBConnection) {
          this.getHistoryDB = this.cachingProxy.getHistoryDB.bind(this.cachingProxy);
          this.getTrendsDB = this.cachingProxy.getTrendsDB.bind(this.cachingProxy);
        }

        this.getTrend = this.zabbixAPI.getTrend.bind(this.zabbixAPI);
        this.getEvents = this.zabbixAPI.getEvents.bind(this.zabbixAPI);
        this.getAlerts = this.zabbixAPI.getAlerts.bind(this.zabbixAPI);
        this.getHostAlerts = this.zabbixAPI.getHostAlerts.bind(this.zabbixAPI);
        this.getAcknowledges = this.zabbixAPI.getAcknowledges.bind(this.zabbixAPI);
        this.getITService = this.zabbixAPI.getITService.bind(this.zabbixAPI);
        this.getSLA = this.zabbixAPI.getSLA.bind(this.zabbixAPI);
        this.getVersion = this.zabbixAPI.getVersion.bind(this.zabbixAPI);
        this.login = this.zabbixAPI.login.bind(this.zabbixAPI);
      }

      _createClass(Zabbix, [{
        key: 'getItemsFromTarget',
        value: function getItemsFromTarget(target, options) {
          var parts = ['group', 'host', 'application', 'item'];
          var filters = _.map(parts, function (p) {
            return target[p].filter;
          });
          return this.getItems.apply(this, _toConsumableArray(filters).concat([options]));
        }
      }, {
        key: 'getHostsFromTarget',
        value: function getHostsFromTarget(target) {
          var parts = ['group', 'host', 'application'];
          var filters = _.map(parts, function (p) {
            return target[p].filter;
          });
          return Promise.all([this.getHosts.apply(this, _toConsumableArray(filters)), this.getApps.apply(this, _toConsumableArray(filters))]).then(function (results) {
            var _results = _slicedToArray(results, 2),
                hosts = _results[0],
                apps = _results[1];

            if (apps.appFilterEmpty) {
              apps = [];
            }
            return [hosts, apps];
          });
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
      }, {
        key: 'getAllHosts',
        value: function getAllHosts(groupFilter) {
          var _this = this;

          return this.getGroups(groupFilter).then(function (groups) {
            var groupids = _.map(groups, 'groupid');
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
      }, {
        key: 'getAllApps',
        value: function getAllApps(groupFilter, hostFilter) {
          var _this2 = this;

          return this.getHosts(groupFilter, hostFilter).then(function (hosts) {
            var hostids = _.map(hosts, 'hostid');
            return _this2.cachingProxy.getApps(hostids);
          });
        }
      }, {
        key: 'getApps',
        value: function getApps(groupFilter, hostFilter, appFilter) {
          var _this3 = this;

          return this.getHosts(groupFilter, hostFilter).then(function (hosts) {
            var hostids = _.map(hosts, 'hostid');
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
              var appids = _.map(apps, 'applicationid');
              return _this4.cachingProxy.getItems(undefined, appids, options.itemtype);
            }
          }).then(function (items) {
            if (!options.showDisabledItems) {
              items = _.filter(items, { 'status': '0' });
            }

            return items;
          }).then(this.expandUserMacro.bind(this));
        }
      }, {
        key: 'expandUserMacro',
        value: function expandUserMacro(items) {
          var hostids = getHostIds(items);
          return this.getMacros(hostids).then(function (macros) {
            _.forEach(items, function (item) {
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
      }, {
        key: 'getITServices',
        value: function getITServices(itServiceFilter) {
          return this.cachingProxy.getITServices().then(function (itServices) {
            return findByFilter(itServices, itServiceFilter);
          });
        }
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
              query.applicationids = _.flatten(_.map(filteredApps, 'applicationid'));
            }
            if (hostFilter) {
              query.hostids = _.map(filteredHosts, 'hostid');
            }
            if (groupFilter) {
              query.groupids = _.map(filteredGroups, 'groupid');
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

  ///////////////////////////////////////////////////////////////////////////////

  /**
   * Find group, host, app or item by given name.
   * @param  list list of groups, apps or other
   * @param  name visible name
   * @return      array with finded element or empty array
   */
  function findByName(list, name) {
    var finded = _.find(list, { 'name': name });
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
    var finded = _.filter(list, { 'name': name });
    if (finded) {
      return finded;
    } else {
      return [];
    }
  }

  function filterByRegex(list, regex) {
    var filterPattern = utils.buildRegex(regex);
    return _.filter(list, function (zbx_obj) {
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
    var hostIds = _.map(items, function (item) {
      return _.map(item.hosts, 'hostid');
    });
    return _.uniq(_.flatten(hostIds));
  }
  return {
    setters: [function (_angular) {
      angular = _angular.default;
    }, function (_lodash) {
      _ = _lodash.default;
    }, function (_utils) {
      utils = _utils;
    }, function (_zabbixAPIServiceJs) {}, function (_zabbixCachingProxyServiceJs) {}, function (_zabbixDBConnector) {}],
    execute: function () {
      _slicedToArray = function () {
        function sliceIterator(arr, i) {
          var _arr = [];
          var _n = true;
          var _d = false;
          var _e = undefined;

          try {
            for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
              _arr.push(_s.value);

              if (i && _arr.length === i) break;
            }
          } catch (err) {
            _d = true;
            _e = err;
          } finally {
            try {
              if (!_n && _i["return"]) _i["return"]();
            } finally {
              if (_d) throw _e;
            }
          }

          return _arr;
        }

        return function (arr, i) {
          if (Array.isArray(arr)) {
            return arr;
          } else if (Symbol.iterator in Object(arr)) {
            return sliceIterator(arr, i);
          } else {
            throw new TypeError("Invalid attempt to destructure non-iterable instance");
          }
        };
      }();

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

      angular.module('grafana.services').factory('Zabbix', ZabbixFactory);
    }
  };
});
//# sourceMappingURL=zabbix.js.map
