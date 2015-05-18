define([
  'angular',
  'lodash',
  'kbn',
  './queryCtrl',
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ZabbixAPIDatasource', function($q, backendSrv, templateSrv) {

    function ZabbixAPIDatasource(datasource) {
      this.type             = 'zabbix';
      this.name             = datasource.name;

      this.url              = datasource.url;

      // TODO: fix passing username and password from config.html
      this.username         = datasource.meta.username;
      this.password         = datasource.meta.password;

      // No datapoints limit by default
      this.limitMetrics     = datasource.limitMetrics || 0;
      this.supportMetrics   = true;
      this.supportAnnotations = true;

      // For testing
      this.ds = datasource;
    }


    ZabbixAPIDatasource.prototype.query = function(options) {
      // get from & to in seconds
      var from = Math.ceil(kbn.parseDate(options.range.from).getTime() / 1000);
      var to = Math.ceil(kbn.parseDate(options.range.to).getTime() / 1000);

      // Create request for each target
      var promises = _.map(options.targets, function(target) {

        // Remove undefined and hidden targets
        if (target.hide || !target.item) {
          return [];
        }

        // Perform request and then handle result
        return this.performTimeSeriesQuery(target.item, from, to).then(_.partial(
          this.handleZabbixAPIResponse, target));
      }, this);

      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });
    };


    // Request data from Zabbix API
    ZabbixAPIDatasource.prototype.handleZabbixAPIResponse = function(target, response) {
      /**
       * Response should be in the format:
       * data: [
       *          {
       *             target: "Metric name",
       *             datapoints: [[<value>, <unixtime>], ...]
       *          },
       *          {
       *             target: "Metric name",
       *             datapoints: [[<value>, <unixtime>], ...]
       *          },
       *       ]
       */

      var series = {
        target: target.alias,
        datapoints: _.map(response, function (p) {
          // Value must be a number for properly work
          var value = Number(p.value);
          return [value, p.clock * 1000];
        })
      };

      return $q.when(series);
    };


    // Request data from Zabbix API
    ZabbixAPIDatasource.prototype.performZabbixAPIRequest = function(request_data) {
      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        url: this.url,
        data: request_data
      };

      var performedQuery;

      // Check authorization first
      if (!this.auth) {
        var self = this;
        performedQuery = this.performZabbixAPILogin().then(function (response) {
          self.auth = response;
          options.data.auth = response;
          return backendSrv.datasourceRequest(options);
        });
      } else {
        performedQuery = backendSrv.datasourceRequest(options);
      }

      // Handle response
      return performedQuery.then(function (response) {
        if (!response.data) {
          return [];
        }
        return response.data.result;
      });
    };


    /**
     * Perform time series query to Zabbix API
     *
     * @param items: array of zabbix api item objects
     */
    ZabbixAPIDatasource.prototype.performTimeSeriesQuery = function(items, start, end) {
      var data = {
        jsonrpc: '2.0',
        method: 'history.get',
        params: {
          output: 'extend',
          history: items.value_type,
          itemids: items.itemid,
          sortfield: 'clock',
          sortorder: 'ASC',
          limit: this.limitmetrics,
          time_from: start,
        },
        auth: this.auth,
        id: 1
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (end) {
        data.params.time_till = end;
      }

      return this.performZabbixAPIRequest(data);
    };


    // Get authentication token
    ZabbixAPIDatasource.prototype.performZabbixAPILogin = function() {
      var options = {
        url : this.url,
        method : 'POST',
        data: {
          jsonrpc: '2.0',
          method: 'user.login',
          params: {
            user: this.username,
            password: this.password
          },
          auth: null,
          id: 1
        },
      };

      return backendSrv.datasourceRequest(options).then(function (result) {
        if (!result.data) {
          return null;
        }
        return result.data.result;
      });
    };


    // Get the list of host groups
    ZabbixAPIDatasource.prototype.performHostGroupSuggestQuery = function() {
      var data = {
        jsonrpc: '2.0',
        method: 'hostgroup.get',
        params: {
          output: ['name'],
          real_hosts: true, //Return only host groups that contain hosts
          sortfield: 'name'
        },
        auth: this.auth,
        id: 1
      };

      return this.performZabbixAPIRequest(data);
    };


    // Get the list of hosts
    ZabbixAPIDatasource.prototype.performHostSuggestQuery = function(groupid) {
      var data = {
        jsonrpc: '2.0',
        method: 'host.get',
        params: {
          output: ['name'],
          sortfield: 'name'
        },
        auth: this.auth,
        id: 1
      };
      if (groupid) {
        data.params.groupids = groupid;
      }

      return this.performZabbixAPIRequest(data);
    };


    // Get the list of applications
    ZabbixAPIDatasource.prototype.performAppSuggestQuery = function(hostid) {
      var data = {
        jsonrpc: '2.0',
        method: 'application.get',
        params: {
          output: ['name'],
          sortfield: 'name',
          hostids: hostid
        },
        auth: this.auth,
        id: 1
      };

      return this.performZabbixAPIRequest(data);
    };


    // Get the list of host items
    ZabbixAPIDatasource.prototype.performItemSuggestQuery = function(hostid, applicationid) {
      var data = {
        jsonrpc: '2.0',
        method: 'item.get',
        params: {
          output: ['name', 'key_', 'value_type', 'delay'],
          sortfield: 'name',
          hostids: hostid,
          webitems: true, //Include web items in the result
          filter: {
            value_type: [0,3]
          }
        },
        auth: this.auth,
        id: 1
      };
      // If application selected return only relative items
      if (applicationid) {
        data.params.applicationids = applicationid;
      }

      return this.performZabbixAPIRequest(data);
    };


    ZabbixAPIDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      var from = kbn.parseDate(rangeUnparsed.from).getTime();
      var to = kbn.parseDate(rangeUnparsed.to).getTime();
      var self = this;
      from = Math.ceil(from/1000);
      to = Math.ceil(to/1000);

      var tid_options = {
        method: 'POST',
        url: self.url + '',
        data: {
          jsonrpc: '2.0',
          method: 'trigger.get',
          params: {
              output: ['triggerid', 'description'],
              itemids: annotation.aids.split(','), // TODO: validate / pull automatically from dashboard.
              limit: self.limitmetrics,
          },
          auth: self.auth,
          id: 1
        },
      };

      return backendSrv.datasourceRequest(tid_options).then(function(result) {
        var obs = {};
        obs = _.indexBy(result.data.result, 'triggerid');

        var options = {
          method: 'POST',
          url: self.url + '',
          data: {
            jsonrpc: '2.0',
            method: 'event.get',
            params: {
                output: 'extend',
                sortorder: 'DESC',
                time_from: from,
                time_till: to,
                objectids: _.keys(obs),
                limit: self.limitmetrics,
            },
            auth: self.auth,
            id: 1
          },
        };

        return backendSrv.datasourceRequest(options).then(function(result2) {
          var list = [];
          _.each(result2.data.result, function(e) {
            list.push({
              annotation: annotation,
              time: e.clock * 1000,
              title: obs[e.objectid].description,
              text: e.eventid,
            });
          });
          return list;
        });
      });
    };

    return ZabbixAPIDatasource;
  });
});
