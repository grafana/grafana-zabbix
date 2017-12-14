'use strict';

System.register(['angular', 'lodash', './utils', './zabbixAPICore.service'], function (_export, _context) {
  "use strict";

  var angular, _, utils, _slicedToArray, _createClass;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  /** @ngInject */
  function ZabbixAPIServiceFactory(alertSrv, zabbixAPICoreService) {
    var ZabbixAPI = function () {
      function ZabbixAPI(api_url, username, password, basicAuth, withCredentials) {
        _classCallCheck(this, ZabbixAPI);

        this.url = api_url;
        this.username = username;
        this.password = password;
        this.auth = "";

        this.requestOptions = {
          basicAuth: basicAuth,
          withCredentials: withCredentials
        };

        this.loginPromise = null;
        this.loginErrorCount = 0;
        this.maxLoginAttempts = 3;

        this.alertSrv = alertSrv;
        this.zabbixAPICore = zabbixAPICoreService;

        this.getTrend = this.getTrend_ZBXNEXT1193;
        //getTrend = getTrend_30;
      }

      //////////////////////////
      // Core method wrappers //
      //////////////////////////

      _createClass(ZabbixAPI, [{
        key: 'request',
        value: function request(method, params) {
          var _this = this;

          return this.zabbixAPICore.request(this.url, method, params, this.requestOptions, this.auth).catch(function (error) {
            if (isNotAuthorized(error.data)) {
              // Handle auth errors
              _this.loginErrorCount++;
              if (_this.loginErrorCount > _this.maxLoginAttempts) {
                _this.loginErrorCount = 0;
                return null;
              } else {
                return _this.loginOnce().then(function () {
                  return _this.request(method, params);
                });
              }
            } else {
              // Handle API errors
              var message = error.data ? error.data : error.statusText;
              _this.alertAPIError(message);
            }
          });
        }
      }, {
        key: 'alertAPIError',
        value: function alertAPIError(message) {
          var timeout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 5000;

          this.alertSrv.set("Zabbix API Error", message, 'error', timeout);
        }
      }, {
        key: 'loginOnce',
        value: function loginOnce() {
          var _this2 = this;

          if (!this.loginPromise) {
            this.loginPromise = Promise.resolve(this.login().then(function (auth) {
              _this2.auth = auth;
              _this2.loginPromise = null;
              return auth;
            }));
          }
          return this.loginPromise;
        }
      }, {
        key: 'login',
        value: function login() {
          return this.zabbixAPICore.login(this.url, this.username, this.password, this.requestOptions);
        }
      }, {
        key: 'getVersion',
        value: function getVersion() {
          return this.zabbixAPICore.getVersion(this.url, this.requestOptions);
        }
      }, {
        key: 'acknowledgeEvent',
        value: function acknowledgeEvent(eventid, message) {
          var params = {
            eventids: eventid,
            message: message
          };

          return this.request('event.acknowledge', params);
        }
      }, {
        key: 'getGroups',
        value: function getGroups() {
          var params = {
            output: ['name'],
            sortfield: 'name',
            real_hosts: true
          };

          return this.request('hostgroup.get', params);
        }
      }, {
        key: 'getHosts',
        value: function getHosts(groupids) {
          var params = {
            output: ['name', 'host'],
            sortfield: 'name'
          };
          if (groupids) {
            params.groupids = groupids;
          }

          return this.request('host.get', params);
        }
      }, {
        key: 'getApps',
        value: function getApps(hostids) {
          var params = {
            output: 'extend',
            hostids: hostids
          };

          return this.request('application.get', params);
        }
      }, {
        key: 'getItems',
        value: function getItems(hostids, appids, itemtype) {
          var params = {
            output: ['name', 'key_', 'value_type', 'hostid', 'status', 'state'],
            sortfield: 'name',
            webitems: true,
            filter: {},
            selectHosts: ['hostid', 'name']
          };
          if (hostids) {
            params.hostids = hostids;
          }
          if (appids) {
            params.applicationids = appids;
          }
          if (itemtype === 'num') {
            // Return only numeric metrics
            params.filter.value_type = [0, 3];
          }
          if (itemtype === 'text') {
            // Return only text metrics
            params.filter.value_type = [1, 2, 4];
          }

          return this.request('item.get', params).then(utils.expandItems);
        }
      }, {
        key: 'getItemsByIDs',
        value: function getItemsByIDs(itemids) {
          var params = {
            itemids: itemids,
            output: ['name', 'key_', 'value_type', 'hostid', 'status', 'state'],
            webitems: true,
            selectHosts: ['hostid', 'name']
          };

          return this.request('item.get', params).then(utils.expandItems);
        }
      }, {
        key: 'getMacros',
        value: function getMacros(hostids) {
          var params = {
            output: 'extend',
            hostids: hostids
          };

          return this.request('usermacro.get', params);
        }
      }, {
        key: 'getGlobalMacros',
        value: function getGlobalMacros() {
          var params = {
            output: 'extend',
            globalmacro: true
          };

          return this.request('usermacro.get', params);
        }
      }, {
        key: 'getLastValue',
        value: function getLastValue(itemid) {
          var params = {
            output: ['lastvalue'],
            itemids: itemid
          };
          return this.request('item.get', params).then(function (items) {
            return items.length ? items[0].lastvalue : null;
          });
        }
      }, {
        key: 'getHistory',
        value: function getHistory(items, timeFrom, timeTill) {
          var _this3 = this;

          // Group items by value type and perform request for each value type
          var grouped_items = _.groupBy(items, 'value_type');
          var promises = _.map(grouped_items, function (items, value_type) {
            var itemids = _.map(items, 'itemid');
            var params = {
              output: 'extend',
              history: value_type,
              itemids: itemids,
              sortfield: 'clock',
              sortorder: 'ASC',
              time_from: timeFrom
            };

            // Relative queries (e.g. last hour) don't include an end time
            if (timeTill) {
              params.time_till = timeTill;
            }

            return _this3.request('history.get', params);
          });

          return Promise.all(promises).then(_.flatten);
        }
      }, {
        key: 'getTrend_ZBXNEXT1193',
        value: function getTrend_ZBXNEXT1193(items, timeFrom, timeTill) {
          var _this4 = this;

          // Group items by value type and perform request for each value type
          var grouped_items = _.groupBy(items, 'value_type');
          var promises = _.map(grouped_items, function (items, value_type) {
            var itemids = _.map(items, 'itemid');
            var params = {
              output: 'extend',
              trend: value_type,
              itemids: itemids,
              sortfield: 'clock',
              sortorder: 'ASC',
              time_from: timeFrom
            };

            // Relative queries (e.g. last hour) don't include an end time
            if (timeTill) {
              params.time_till = timeTill;
            }

            return _this4.request('trend.get', params);
          });

          return Promise.all(promises).then(_.flatten);
        }
      }, {
        key: 'getTrend_30',
        value: function getTrend_30(items, time_from, time_till, value_type) {
          var self = this;
          var itemids = _.map(items, 'itemid');

          var params = {
            output: ["itemid", "clock", value_type],
            itemids: itemids,
            time_from: time_from
          };

          // Relative queries (e.g. last hour) don't include an end time
          if (time_till) {
            params.time_till = time_till;
          }

          return self.request('trend.get', params);
        }
      }, {
        key: 'getITService',
        value: function getITService(serviceids) {
          var params = {
            output: 'extend',
            serviceids: serviceids
          };
          return this.request('service.get', params);
        }
      }, {
        key: 'getSLA',
        value: function getSLA(serviceids, timeRange) {
          var _timeRange = _slicedToArray(timeRange, 2),
              timeFrom = _timeRange[0],
              timeTo = _timeRange[1];

          var params = {
            serviceids: serviceids,
            intervals: [{
              from: timeFrom,
              to: timeTo
            }]
          };
          return this.request('service.getsla', params);
        }
      }, {
        key: 'getTriggers',
        value: function getTriggers(groupids, hostids, applicationids, options) {
          var showTriggers = options.showTriggers,
              maintenance = options.maintenance,
              timeFrom = options.timeFrom,
              timeTo = options.timeTo;


          var params = {
            output: 'extend',
            groupids: groupids,
            hostids: hostids,
            applicationids: applicationids,
            expandDescription: true,
            expandData: true,
            expandComment: true,
            monitored: true,
            skipDependent: true,
            //only_true: true,
            filter: {
              value: 1
            },
            selectGroups: ['name'],
            selectHosts: ['name', 'host', 'maintenance_status'],
            selectItems: ['name', 'key_', 'lastvalue'],
            selectLastEvent: 'extend',
            selectTags: 'extend'
          };

          if (showTriggers) {
            params.filter.value = showTriggers;
          }

          if (maintenance) {
            params.maintenance = true;
          }

          if (timeFrom || timeTo) {
            params.lastChangeSince = timeFrom;
            params.lastChangeTill = timeTo;
          }

          return this.request('trigger.get', params);
        }
      }, {
        key: 'getEvents',
        value: function getEvents(objectids, timeFrom, timeTo, showEvents) {
          var params = {
            output: 'extend',
            time_from: timeFrom,
            time_till: timeTo,
            objectids: objectids,
            select_acknowledges: 'extend',
            selectHosts: 'extend',
            value: showEvents
          };

          return this.request('event.get', params);
        }
      }, {
        key: 'getAcknowledges',
        value: function getAcknowledges(eventids) {
          var params = {
            output: 'extend',
            eventids: eventids,
            preservekeys: true,
            select_acknowledges: 'extend',
            sortfield: 'clock',
            sortorder: 'DESC'
          };

          return this.request('event.get', params).then(function (events) {
            return _.filter(events, function (event) {
              return event.acknowledges.length;
            });
          });
        }
      }, {
        key: 'getAlerts',
        value: function getAlerts(itemids, timeFrom, timeTo) {
          var params = {
            output: 'extend',
            itemids: itemids,
            expandDescription: true,
            expandData: true,
            expandComment: true,
            monitored: true,
            skipDependent: true,
            //only_true: true,
            // filter: {
            //   value: 1
            // },
            selectLastEvent: 'extend'
          };

          if (timeFrom || timeTo) {
            params.lastChangeSince = timeFrom;
            params.lastChangeTill = timeTo;
          }

          return this.request('trigger.get', params);
        }
      }, {
        key: 'getHostAlerts',
        value: function getHostAlerts(hostids, applicationids, options) {
          var minSeverity = options.minSeverity,
              acknowledged = options.acknowledged,
              count = options.count,
              timeFrom = options.timeFrom,
              timeTo = options.timeTo;

          var params = {
            output: 'extend',
            hostids: hostids,
            min_severity: minSeverity,
            filter: { value: 1 },
            expandDescription: true,
            expandData: true,
            expandComment: true,
            monitored: true,
            skipDependent: true,
            selectLastEvent: 'extend',
            selectGroups: 'extend',
            selectHosts: ['host', 'name']
          };

          if (count && acknowledged !== 0 && acknowledged !== 1) {
            params.countOutput = true;
          }

          if (applicationids && applicationids.length) {
            params.applicationids = applicationids;
          }

          if (timeFrom || timeTo) {
            params.lastChangeSince = timeFrom;
            params.lastChangeTill = timeTo;
          }

          return this.request('trigger.get', params).then(function (triggers) {
            if (!count || acknowledged === 0 || acknowledged === 1) {
              triggers = filterTriggersByAcknowledge(triggers, acknowledged);
              if (count) {
                triggers = triggers.length;
              }
            }
            return triggers;
          });
        }
      }]);

      return ZabbixAPI;
    }();

    return ZabbixAPI;
  }

  function filterTriggersByAcknowledge(triggers, acknowledged) {
    if (acknowledged === 0) {
      return _.filter(triggers, function (trigger) {
        return trigger.lastEvent.acknowledged === "0";
      });
    } else if (acknowledged === 1) {
      return _.filter(triggers, function (trigger) {
        return trigger.lastEvent.acknowledged === "1";
      });
    } else {
      return triggers;
    }
  }

  function isNotAuthorized(message) {
    return message === "Session terminated, re-login, please." || message === "Not authorised." || message === "Not authorized.";
  }

  return {
    setters: [function (_angular) {
      angular = _angular.default;
    }, function (_lodash) {
      _ = _lodash.default;
    }, function (_utils) {
      utils = _utils;
    }, function (_zabbixAPICoreService) {}],
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

      angular.module('grafana.services').factory('zabbixAPIService', ZabbixAPIServiceFactory);
    }
  };
});
//# sourceMappingURL=zabbixAPI.service.js.map
