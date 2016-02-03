define([
  'angular',
  'lodash',
  './zabbixAPIService'
  ],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  /**
   * Zabbix API Wrapper.
   * Creates Zabbix API instance with given parameters (url, credentials and other).
   * Wraps API calls and provides high-level methods.
   */
  module.factory('ZabbixAPI', function($q, backendSrv, alertSrv, ZabbixAPIService) {

    // Initialize Zabbix API.
    function ZabbixAPI(api_url, username, password, basicAuth, withCredentials) {
      this.url              = api_url;
      this.username         = username;
      this.password         = password;
      this.auth             = "";

      this.requestOptions = {
        basicAuth: basicAuth,
        withCredentials: withCredentials
      };

      this.loginPromise = null;
    }

    var p = ZabbixAPI.prototype;

    //////////////////
    // Core methods //
    //////////////////

    p.request = function(method, params) {
      var self = this;

      return ZabbixAPIService.request(this.url, method, params, this.requestOptions, this.auth)
        .then(function(result) {
          return result;
        },
        // Handle API errors
        function(error) {
          if (isNotAuthorized(error.data)) {
            return self.loginOnce().then(
              function() {
                return self.request(method, params);
              },
              // Handle user.login method errors
              function(error) {
                self.alertAPIError(error.data);
              });
          }
        });
    };

    p.alertAPIError = function(message) {
      alertSrv.set(
        "Zabbix API Error",
        message,
        'error'
      );
    };

    function isNotAuthorized(message) {
      return (
        message === "Session terminated, re-login, please." ||
        message === "Not authorised." ||
        message === "Not authorized."
      );
    }

    /**
     * When API unauthenticated or auth token expired each request produce login()
     * call. But auth token is common to all requests. This function wraps login() method
     * and call it once. If login() already called just wait for it (return its promise).
     * @return login promise
     */
    p.loginOnce = function() {
      var self = this;
      var deferred  = $q.defer();
      if (!self.loginPromise) {
        self.loginPromise = deferred.promise;
        self.login().then(
          function(auth) {
            self.loginPromise = null;
            self.auth = auth;
            deferred.resolve(auth);
          },
          function(error) {
            self.loginPromise = null;
            deferred.reject(error);
          }
        );
      } else {
        return self.loginPromise;
      }
      return deferred.promise;
    };

    /**
     * Get authentication token.
     */
    p.login = function() {
      return ZabbixAPIService.login(this.url, this.username, this.password, this.requestOptions);
    };

    /**
     * Get Zabbix API version
     */
    p.getVersion = function() {
      return ZabbixAPIService.getVersion(this.url, this.requestOptions);
    };

    /////////////////
    // API methods //
    /////////////////

    p.getGroups = function() {
      var params = {
        output: ['name'],
        sortfield: 'name'
      };

      return this.request('hostgroup.get', params);
    };

    p.getHosts = function() {
      var params = {
        output: ['name', 'host'],
        sortfield: 'name',
        selectGroups: []
      };

      return this.request('host.get', params);
    };

    p.getApplications = function() {
      var params = {
        output: ['name'],
        sortfield: 'name',

        // Hack for supporting different apis (2.2 vs 2.4 vs 3.0)
        selectHost: [],
        selectHosts: []
      };

      return this.request('application.get', params);
    };

    p.getItems = function() {
      var params = {
        output: [
          'name', 'key_',
          'value_type',
          'hostid',
          'status',
          'state'
        ],
        sortfield: 'name',
        selectApplications: []
      };

      return this.request('item.get', params);
    };

    p.getLastValue = function(itemid) {
      var params = {
        output: ['lastvalue'],
        itemids: itemid
      };
      return this.request('item.get', params).then(function(items) {
        if (items.length) {
          return items[0].lastvalue;
        } else {
          return null;
        }
      });
    };

    /**
     * Perform history query from Zabbix API
     *
     * @param  {Array}  items       Array of Zabbix item objects
     * @param  {Number} time_from   Time in seconds
     * @param  {Number} time_till   Time in seconds
     * @return {Array}  Array of Zabbix history objects
     */
    p.getHistory = function(items, time_from, time_till) {
      var self = this;

      // Group items by value type
      var grouped_items = _.groupBy(items, 'value_type');

      // Perform request for each value type
      return $q.all(_.map(grouped_items, function (items, value_type) {
        var itemids = _.map(items, 'itemid');
        var params = {
          output: 'extend',
          history: value_type,
          itemids: itemids,
          sortfield: 'clock',
          sortorder: 'ASC',
          time_from: time_from
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (time_till) {
          params.time_till = time_till;
        }

        return self.request('history.get', params);
      })).then(_.flatten);
    };

    /**
     * Perform trends query from Zabbix API
     * Use trends api extension from ZBXNEXT-1193 patch.
     *
     * @param  {Array}  items       Array of Zabbix item objects
     * @param  {Number} time_from   Time in seconds
     * @param  {Number} time_till   Time in seconds
     * @return {Array}  Array of Zabbix trend objects
     */
    p.getTrend_ZBXNEXT1193 = function(items, time_from, time_till) {
      var self = this;

      // Group items by value type
      var grouped_items = _.groupBy(items, 'value_type');

      // Perform request for each value type
      return $q.all(_.map(grouped_items, function (items, value_type) {
        var itemids = _.map(items, 'itemid');
        var params = {
          output: 'extend',
          trend: value_type,
          itemids: itemids,
          sortfield: 'clock',
          sortorder: 'ASC',
          time_from: time_from
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (time_till) {
          params.time_till = time_till;
        }

        return self.request('trend.get', params);
      })).then(_.flatten);
    };

    p.getTrend_30 = function(items, time_from, time_till, value_type) {
      var self = this;
      var itemids = _.map(items, 'itemid');

      var params = {
        output: ["itemid",
          "clock",
          value_type
        ],
        itemids: itemids,
        time_from: time_from
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (time_till) {
        params.time_till = time_till;
      }

      return self.request('trend.get', params);
    };

    p.getTrend = p.getTrend_ZBXNEXT1193;
    //p.getTrend = p.getTrend_30;

    p.getITService = function(/* optional */ serviceids) {
      var params = {
        output: 'extend',
        serviceids: serviceids
      };
      return this.request('service.get', params);
    };

    p.getSLA = function(serviceids, from, to) {
      var params = {
        serviceids: serviceids,
        intervals: [{
          from: from,
          to: to
        }]
      };
      return this.request('service.getsla', params);
    };

    p.getTriggers = function(groupids, hostids, applicationids) {
      var params = {
        output: 'extend',
        groupids: groupids,
        hostids: hostids,
        applicationids: applicationids,
        expandDescription: true,
        expandData: true,
        monitored: true,
        skipDependent: true,
        //only_true: true,
        filter: {
          value: 1
        },
        selectGroups: ['name'],
        selectHosts: ['name'],
        selectItems: ['name', 'key_', 'lastvalue'],
        selectLastEvent: 'extend'
      };

      return this.request('trigger.get', params);
    };

    p.getAcknowledges = function(eventids) {
      var params = {
        output: 'extend',
        eventids: eventids,
        preservekeys: true,
        select_acknowledges: 'extend',
        sortfield: 'clock',
        sortorder: 'DESC'
      };

      return this.request('event.get', params)
        .then(function (events) {
          return _.filter(events, function(event) {
            return event.acknowledges.length;
          });
        });
    };

    return ZabbixAPI;

  });

});
