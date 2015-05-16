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
      this.name             = datasource.name;
      this.type             = 'zabbix';

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
      var from = kbn.parseDate(options.range.from).getTime();
      var to = kbn.parseDate(options.range.to).getTime();

      // Need for find target alias
      var targets = options.targets;

      // Remove undefined and hidden targets
      var displayedTargets = _.filter(targets, function (target) {
        return (!target.hide && target.item);
      });

      if (displayedTargets.length) {
        // Extract zabbix api item objects from targets
        var target_items = _.map(displayedTargets, 'item');
      } else {
        // No valid targets, return the empty dataset
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      from = Math.ceil(from/1000);
      to = Math.ceil(to/1000);

      return this.performTimeSeriesQuery(target_items, from, to).then(function (response) {
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

        // Index returned datapoints by item/metric id
        var indexed_result = _.groupBy(response, 'itemid');

        // TODO: realize correct timeseries reduce
        /*
        // Reduce timeseries to the same size for stacking and tooltip work properly
        var min_length = _.min(_.map(indexed_result, function (history) {
          return history.length;
        }));
        _.each(indexed_result, function (item) {
          item.splice(0, item.length - min_length);
        });*/

        // Sort result as the same as targets for display
        // stacked timeseries in proper order
        var sorted_history = _.sortBy(indexed_result, function (value, key, list) {
          return _.indexOf(_.map(target_items, 'itemid'), key);
        });

        var series = _.map(sorted_history,
          // Foreach itemid index: iterate over the data points and
          // normalize to Grafana response format.
          function (history, index) {
            return {
              // Lookup itemid:alias map
              //target: targets[itemid].alias,
              target: targets[index].alias,

              datapoints: _.map(history, function (p) {

                // Value must be a number for properly work
                var value = Number(p.value);

                // TODO: Correct time for proper stacking
                //var clock = Math.round(Number(p.clock) / 60) * 60;
                return [value, p.clock * 1000];
              })
            };
          })
        return $q.when({data: series});
      });
    };


    ///////////////////////////////////////////////////////////////////////
    /// Query methods
    ///////////////////////////////////////////////////////////////////////


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

      // Group items by value type for separate requests
      var items_by_value_type = _.groupBy(items, 'value_type');

      var self = this;
      var apiRequests = [];

      // Prepare requests for each value type
      _.each(items_by_value_type, function (value, key, list) {
        var item_ids = _.map(value, 'itemid');
        var history_type = key;
        var data = {
          jsonrpc: '2.0',
          method: 'history.get',
          params: {
            output: 'extend',
            history: history_type,
            itemids: item_ids,
            sortfield: 'clock',
            sortorder: 'ASC',
            limit: self.limitmetrics,
            time_from: start,
          },
          auth: self.auth,
          id: 1
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (end) {
          data.params.time_till = end;
        }

        apiRequests.push(self.performZabbixAPIRequest(data));
      });

      return this.handleMultipleRequest(apiRequests);
    };


    // Handle multiple request
    ZabbixAPIDatasource.prototype.handleMultipleRequest = function(apiRequests) {
      var history = [];
      var performedQuery = null;

      // Build chain of api requests and put all history data into single array
      _.each(apiRequests, function (apiRequest) {
        if(!performedQuery) {
          performedQuery = apiRequest.then(function (response) {
            history = history.concat(response);
            return history;
          });
        } else {
          performedQuery = performedQuery.then(function () {
            return apiRequest.then(function (response) {
              history = history.concat(response);
              return history;
            });
          });
        }
      });

      return performedQuery;
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
