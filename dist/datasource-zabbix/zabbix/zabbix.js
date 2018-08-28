'use strict';

System.register(['lodash', '../utils', '../responseHandler', './connectors/zabbix_api/zabbixAPIConnector', './connectors/sql/sqlConnector', './proxy/cachingProxy', './connectors/dbConnector'], function (_export, _context) {
  "use strict";

  var _, utils, responseHandler, ZabbixAPIConnector, SQLConnector, CachingProxy, ZabbixNotImplemented, _slicedToArray, _createClass, REQUESTS_TO_PROXYFY, REQUESTS_TO_CACHE, REQUESTS_TO_BIND, Zabbix;

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
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_utils) {
      utils = _utils;
    }, function (_responseHandler) {
      responseHandler = _responseHandler.default;
    }, function (_connectorsZabbix_apiZabbixAPIConnector) {
      ZabbixAPIConnector = _connectorsZabbix_apiZabbixAPIConnector.ZabbixAPIConnector;
    }, function (_connectorsSqlSqlConnector) {
      SQLConnector = _connectorsSqlSqlConnector.SQLConnector;
    }, function (_proxyCachingProxy) {
      CachingProxy = _proxyCachingProxy.CachingProxy;
    }, function (_connectorsDbConnector) {
      ZabbixNotImplemented = _connectorsDbConnector.ZabbixNotImplemented;
    }],
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

      REQUESTS_TO_PROXYFY = ['getHistory', 'getTrend', 'getGroups', 'getHosts', 'getApps', 'getItems', 'getMacros', 'getItemsByIDs', 'getEvents', 'getAlerts', 'getHostAlerts', 'getAcknowledges', 'getITService', 'getSLA', 'getVersion'];
      REQUESTS_TO_CACHE = ['getGroups', 'getHosts', 'getApps', 'getItems', 'getMacros', 'getItemsByIDs', 'getITService'];
      REQUESTS_TO_BIND = ['getHistory', 'getTrend', 'getMacros', 'getItemsByIDs', 'getEvents', 'getAlerts', 'getHostAlerts', 'getAcknowledges', 'getITService', 'getVersion', 'login'];

      _export('Zabbix', Zabbix = function () {
        function Zabbix(options, backendSrv, datasourceSrv) {
          _classCallCheck(this, Zabbix);

          var url = options.url,
              username = options.username,
              password = options.password,
              basicAuth = options.basicAuth,
              withCredentials = options.withCredentials,
              cacheTTL = options.cacheTTL,
              enableDirectDBConnection = options.enableDirectDBConnection,
              datasourceId = options.datasourceId;


          this.enableDirectDBConnection = enableDirectDBConnection;

          // Initialize caching proxy for requests
          var cacheOptions = {
            enabled: true,
            ttl: cacheTTL
          };
          this.cachingProxy = new CachingProxy(cacheOptions);

          this.zabbixAPI = new ZabbixAPIConnector(url, username, password, basicAuth, withCredentials, backendSrv);

          if (enableDirectDBConnection) {
            var dbConnectorOptions = { datasourceId: datasourceId };
            this.dbConnector = new SQLConnector(dbConnectorOptions, backendSrv, datasourceSrv);
            this.getHistoryDB = this.cachingProxy.proxyfyWithCache(this.dbConnector.getHistory, 'getHistory', this.dbConnector);
            this.getTrendsDB = this.cachingProxy.proxyfyWithCache(this.dbConnector.getTrends, 'getTrends', this.dbConnector);
          }

          this.proxyfyRequests();
          this.cacheRequests();
          this.bindRequests();
        }

        _createClass(Zabbix, [{
          key: 'proxyfyRequests',
          value: function proxyfyRequests() {
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
              for (var _iterator = REQUESTS_TO_PROXYFY[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var request = _step.value;

                this.zabbixAPI[request] = this.cachingProxy.proxyfy(this.zabbixAPI[request], request, this.zabbixAPI);
              }
            } catch (err) {
              _didIteratorError = true;
              _iteratorError = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }
              } finally {
                if (_didIteratorError) {
                  throw _iteratorError;
                }
              }
            }
          }
        }, {
          key: 'cacheRequests',
          value: function cacheRequests() {
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
              for (var _iterator2 = REQUESTS_TO_CACHE[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var request = _step2.value;

                this.zabbixAPI[request] = this.cachingProxy.cacheRequest(this.zabbixAPI[request], request, this.zabbixAPI);
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                  _iterator2.return();
                }
              } finally {
                if (_didIteratorError2) {
                  throw _iteratorError2;
                }
              }
            }
          }
        }, {
          key: 'bindRequests',
          value: function bindRequests() {
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
              for (var _iterator3 = REQUESTS_TO_BIND[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var request = _step3.value;

                this[request] = this.zabbixAPI[request].bind(this.zabbixAPI);
              }
            } catch (err) {
              _didIteratorError3 = true;
              _iteratorError3 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                  _iterator3.return();
                }
              } finally {
                if (_didIteratorError3) {
                  throw _iteratorError3;
                }
              }
            }
          }
        }, {
          key: 'testDataSource',
          value: function testDataSource() {
            var _this = this;

            var zabbixVersion = void 0;
            var dbConnectorStatus = void 0;
            return this.getVersion().then(function (version) {
              zabbixVersion = version;
              return _this.login();
            }).then(function () {
              if (_this.enableDirectDBConnection) {
                return _this.dbConnector.testDataSource();
              } else {
                return Promise.resolve();
              }
            }).catch(function (error) {
              if (error instanceof ZabbixNotImplemented) {
                return Promise.resolve();
              }
              return Promise.reject(error);
            }).then(function (testResult) {
              if (testResult) {
                dbConnectorStatus = {
                  dsType: _this.dbConnector.datasourceTypeName,
                  dsName: _this.dbConnector.datasourceName
                };
              }
              return { zabbixVersion: zabbixVersion, dbConnectorStatus: dbConnectorStatus };
            });
          }
        }, {
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
            return this.zabbixAPI.getGroups();
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
            var _this2 = this;

            return this.getGroups(groupFilter).then(function (groups) {
              var groupids = _.map(groups, 'groupid');
              return _this2.zabbixAPI.getHosts(groupids);
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
            var _this3 = this;

            return this.getHosts(groupFilter, hostFilter).then(function (hosts) {
              var hostids = _.map(hosts, 'hostid');
              return _this3.zabbixAPI.getApps(hostids);
            });
          }
        }, {
          key: 'getApps',
          value: function getApps(groupFilter, hostFilter, appFilter) {
            var _this4 = this;

            return this.getHosts(groupFilter, hostFilter).then(function (hosts) {
              var hostids = _.map(hosts, 'hostid');
              if (appFilter) {
                return _this4.zabbixAPI.getApps(hostids).then(function (apps) {
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
            var _this5 = this;

            var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

            return this.getApps(groupFilter, hostFilter, appFilter).then(function (apps) {
              if (apps.appFilterEmpty) {
                return _this5.zabbixAPI.getItems(apps.hostids, undefined, options.itemtype);
              } else {
                var appids = _.map(apps, 'applicationid');
                return _this5.zabbixAPI.getItems(undefined, appids, options.itemtype);
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
            return this.zabbixAPI.getITService().then(function (itServices) {
              return findByFilter(itServices, itServiceFilter);
            });
          }
        }, {
          key: 'getTriggers',
          value: function getTriggers(groupFilter, hostFilter, appFilter, options) {
            var _this6 = this;

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
              return _this6.zabbixAPI.getTriggers(query.groupids, query.hostids, query.applicationids, options);
            });
          }
        }, {
          key: 'getHistoryTS',
          value: function getHistoryTS(items, timeRange, options) {
            var _this7 = this;

            var _timeRange = _slicedToArray(timeRange, 2),
                timeFrom = _timeRange[0],
                timeTo = _timeRange[1];

            if (this.enableDirectDBConnection) {
              return this.getHistoryDB(items, timeFrom, timeTo, options).then(function (history) {
                return _this7.dbConnector.handleGrafanaTSResponse(history, items);
              });
            } else {
              return this.zabbixAPI.getHistory(items, timeFrom, timeTo).then(function (history) {
                return responseHandler.handleHistory(history, items);
              });
            }
          }
        }, {
          key: 'getTrends',
          value: function getTrends(items, timeRange, options) {
            var _this8 = this;

            var _timeRange2 = _slicedToArray(timeRange, 2),
                timeFrom = _timeRange2[0],
                timeTo = _timeRange2[1];

            if (this.enableDirectDBConnection) {
              return this.getTrendsDB(items, timeFrom, timeTo, options).then(function (history) {
                return _this8.dbConnector.handleGrafanaTSResponse(history, items);
              });
            } else {
              var valueType = options.consolidateBy || options.valueType;
              return this.zabbixAPI.getTrend(items, timeFrom, timeTo).then(function (history) {
                return responseHandler.handleTrends(history, items, valueType);
              }).then(responseHandler.sortTimeseries); // Sort trend data, issue #202
            }
          }
        }, {
          key: 'getHistoryText',
          value: function getHistoryText(items, timeRange, target) {
            var _timeRange3 = _slicedToArray(timeRange, 2),
                timeFrom = _timeRange3[0],
                timeTo = _timeRange3[1];

            if (items.length) {
              return this.zabbixAPI.getHistory(items, timeFrom, timeTo).then(function (history) {
                if (target.resultFormat === 'table') {
                  return responseHandler.handleHistoryAsTable(history, items, target);
                } else {
                  return responseHandler.handleText(history, items, target);
                }
              });
            } else {
              return Promise.resolve([]);
            }
          }
        }, {
          key: 'getSLA',
          value: function getSLA(itservices, timeRange, target, options) {
            var itServices = itservices;
            if (options.isOldVersion) {
              itServices = _.filter(itServices, { 'serviceid': target.itservice.serviceid });
            }
            var itServiceIds = _.map(itServices, 'serviceid');
            return this.zabbixAPI.getSLA(itServiceIds, timeRange).then(function (slaResponse) {
              return _.map(itServiceIds, function (serviceid) {
                var itservice = _.find(itServices, { 'serviceid': serviceid });
                return responseHandler.handleSLAResponse(itservice, target.slaProperty, slaResponse);
              });
            });
          }
        }]);

        return Zabbix;
      }());

      _export('Zabbix', Zabbix);
    }
  };
});
//# sourceMappingURL=zabbix.js.map
