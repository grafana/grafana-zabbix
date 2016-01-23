define([
  'angular',
  'lodash',
  './zabbixAPIService'
  ],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ZabbixAPI', function($q, backendSrv, ZabbixAPIService) {

    // Initialize Zabbix API.
    function ZabbixAPI(api_url, username, password, basicAuth, withCredentials) {
      this.url              = api_url;
      this.username         = username;
      this.password         = password;
      this.auth             = null;

      this.requestOptions = {
        basicAuth: basicAuth,
        withCredentials: withCredentials
      };
    }

    var p = ZabbixAPI.prototype;

    //////////////////
    // Core methods //
    //////////////////

    p.request = function(method, params) {
      var self = this;
      if (this.auth) {
        return ZabbixAPIService._request(this.url, method, params, this.requestOptions, this.auth);
      } else {

        // Login first
        return ZabbixAPIService.login(this.url, this.username, this.password, this.requestOptions)
          .then(function(auth) {
            self.auth = auth;
            return ZabbixAPIService._request(self.url, method, params, self.requestOptions, self.auth);
          });
      }
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
        selectHosts: []
      };

      return this.request('application.get', params);
    };

    p.getItems = function() {
      var params = {
        output: ['name', 'key_', 'value_type', 'hostid', 'status', 'state'],
        sortfield: 'name',
        selectApplications: []
      };

      return this.request('item.get', params);
    };

    /**
     * Perform history query from Zabbix API
     *
     * @param  {Array}  items Array of Zabbix item objects
     * @param  {Number} start Time in seconds
     * @param  {Number} end   Time in seconds
     * @return {Array}        Array of Zabbix history objects
     */
    p.getHistory = function(items, start, end) {
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
          time_from: start
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (end) {
          params.time_till = end;
        }

        return this.request('history.get', params);
      }, this)).then(function (results) {
        return _.flatten(results);
      });
    };

    /**
     * Perform trends query from Zabbix API
     * Use trends api extension from ZBXNEXT-1193 patch.
     *
     * @param  {Array}  items Array of Zabbix item objects
     * @param  {Number} start Time in seconds
     * @param  {Number} end   Time in seconds
     * @return {Array}        Array of Zabbix trend objects
     */
    p.getTrends = function(items, start, end) {
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
          time_from: start
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (end) {
          params.time_till = end;
        }

        return this.request('trend.get', params);
      }, this)).then(function (results) {
        return _.flatten(results);
      });
    };

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

    p.getTriggers = function(limit, sortfield, groupids, hostids, applicationids, name) {
      var params = {
        output: 'extend',
        expandDescription: true,
        expandData: true,
        monitored: true,
        //only_true: true,
        filter: {
          value: 1
        },
        search : {
          description: name
        },
        searchWildcardsEnabled: false,
        groupids: groupids,
        hostids: hostids,
        applicationids: applicationids,
        limit: limit,
        sortfield: 'lastchange',
        sortorder: 'DESC'
      };

      if (sortfield) {
        params.sortfield = sortfield;
      }

      return this.request('trigger.get', params);
    };

    p.getAcknowledges = function(triggerids, from) {
      var params = {
        output: 'extend',
        objectids: triggerids,
        acknowledged: true,
        select_acknowledges: 'extend',
        sortfield: 'clock',
        sortorder: 'DESC',
        time_from: from
      };

      return this.request('event.get', params)
        .then(function (events) {
          return _.flatten(_.map(events, 'acknowledges'));
        });
    };

    return ZabbixAPI;

  });

});
