'use strict';

System.register(['angular', 'lodash', './utils', './zabbixAPICore.service'], function (_export, _context) {
  "use strict";

  var angular, _, utils, _createClass;

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
            output: ['applicationid', 'name'],
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

          return this.request('item.get', params).then(expandItems);

          function expandItems(items) {
            items.forEach(function (item) {
              item.item = item.name;
              item.name = utils.expandItemName(item.item, item.key_);
              return item;
            });
            return items;
          }
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
        value: function getSLA(serviceids, timeFrom, timeTo) {
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
        value: function getTriggers(groupids, hostids, applicationids, showTriggers, hideHostsInMaintenance, timeFrom, timeTo) {
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
            selectHosts: ['name', 'host'],
            selectItems: ['name', 'key_', 'lastvalue'],
            selectLastEvent: 'extend'
          };

          if (showTriggers) {
            params.filter.value = showTriggers;
          }

          if (hideHostsInMaintenance) {
            params.maintenance = false;
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
      }]);

      return ZabbixAPI;
    }();

    return ZabbixAPI;
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
