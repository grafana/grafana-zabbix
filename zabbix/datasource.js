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
      this.url              = datasource.url;

      // TODO: fix passing username and password from config.html
      this.username         = datasource.meta.username;
      this.password         = datasource.meta.password;

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
    ZabbixAPIDatasource.prototype.performZabbixAPIRequest = function(method, params) {
      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        url: this.url,
        data: {
          jsonrpc: '2.0',
          method: method,
          params: params,
          auth: this.auth,
          id: 1
        }
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
      var params = {
        output: 'extend',
        history: items.value_type,
        itemids: items.itemid,
        sortfield: 'clock',
        sortorder: 'ASC',
        time_from: start
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (end) {
        params.time_till = end;
      }

      return this.performZabbixAPIRequest('history.get', params);
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
      var params = {
        output: ['name'],
        real_hosts: true, //Return only host groups that contain hosts
        sortfield: 'name'
      };

      return this.performZabbixAPIRequest('hostgroup.get', params);
    };


    // Get the list of hosts
    ZabbixAPIDatasource.prototype.performHostSuggestQuery = function(groupid) {
      var params = {
        output: ['name'],
        sortfield: 'name'
      };
      // Return only hosts in given group
      if (groupid) {
        params.groupids = groupid;
      }
      return this.performZabbixAPIRequest('host.get', params);
    };


    // Get the list of applications
    ZabbixAPIDatasource.prototype.performAppSuggestQuery = function(hostid) {
      var params = {
        output: ['name'],
        sortfield: 'name',
        hostids: hostid
      };

      return this.performZabbixAPIRequest('application.get', params);
    };


    // Get the list of host items
    ZabbixAPIDatasource.prototype.performItemSuggestQuery = function(hostid, applicationid) {
      var params = {
        output: ['name', 'key_', 'value_type', 'delay'],
        sortfield: 'name',
        hostids: hostid,

        //Include web items in the result
        webitems: true,
        // Return only numeric items
        filter: {
          value_type: [0,3]
        }
      };
      // If application selected return only relative items
      if (applicationid) {
        params.applicationids = applicationid;
      }

      return this.performZabbixAPIRequest('item.get', params);
    };


    // For templated query
    ZabbixAPIDatasource.prototype.metricFindQuery = function (query) {
      var interpolated;
      try {
        interpolated = templateSrv.replace(query);
      }
      catch (err) {
        return $q.reject(err);
      }

      var parts = interpolated.split('.');
      var template = {
        'group': parts[0],
        'host': parts[1],
        'item': parts[2]
      };

      var params = {
        output: ['name'],
        sortfield: 'name',
        // Case insensitive search
        search: {
          name : template.group
        }
      };

      var self = this;
      return this.performZabbixAPIRequest('hostgroup.get', params)
        .then(function (result) {
          var groupid = null;
          if (result.length && template.group) {
            groupid = result[0].groupid;
          }
          return self.performHostSuggestQuery(groupid)
            .then(function (result) {
              return _.map(result, function (host) {
                return {
                  text: host.name,
                  expandable: false
                };
              });
            });
        });
    };


    ZabbixAPIDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      var from = Math.ceil(kbn.parseDate(rangeUnparsed.from).getTime() / 1000);
      var to = Math.ceil(kbn.parseDate(rangeUnparsed.to).getTime() / 1000);
      var self = this;

      var params = {
        output: ['triggerid', 'description'],
        search: {
          'description': annotation.query
        },
      };

      return this.performZabbixAPIRequest('trigger.get', params).then(function (result) {
        if(result) {
          var obs = {};
          obs = _.indexBy(result, 'triggerid');

          var params = {
            output: 'extend',
            sortorder: 'DESC',
            time_from: from,
            time_till: to,
            objectids: _.keys(obs)
          };

          return self.performZabbixAPIRequest('event.get', params).then(function (result) {
            var events = [];
            _.each(result, function(e) {
              events.push({
                annotation: annotation,
                time: e.clock * 1000,
                title: obs[e.objectid].description,
                text: e.eventid,
              });
            });
            return events;
          });
        } else {
          return [];
        }
      });
    };

    return ZabbixAPIDatasource;
  });
});
