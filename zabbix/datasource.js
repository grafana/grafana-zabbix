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

      // Limit metrics per panel
      this.limitmetrics = datasource.meta.limitmetrics || 20;

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

        if (!target.item.templated) {

          // Perform request and then handle result
          return this.performTimeSeriesQuery(target.item, from, to).then(_.partial(
            this.handleZabbixAPIResponse, target.alias));
        } else {
          // Handle templated target

          var itemname = templateSrv.replace(target.item.name);
          var hostname = templateSrv.replace(target.host.name);

          // Extract zabbix hosts
          var host_pattern = /([\w\.\s]+)/g;
          var hosts = hostname.match(host_pattern);

          // Extract item names
          var itemname_pattern = /([^{},]+)/g;
          var itemnames = itemname.match(itemname_pattern);

          if (itemnames.length < this.limitmetrics) {
            // Find items by item names and perform queries
            var self = this;
            return $q.all(_.map(hosts, function (hostname) {
              return this.findZabbixItem(hostname, itemnames);
            }, this)).then(function (items) {
              items = _.flatten(items);
              return self.performTimeSeriesQuery(items, from, to)
                .then(_.partial(self.handleZabbixAPIResponse, items));
              });
          } else {
            return [];
          }
        }
      }, this);

      return $q.all(_.flatten(promises)).then(function (results) {
        return { data: _.flatten(results) };
      });
    };


    /**
     * Perform time series query to Zabbix API
     *
     * @param items: array of zabbix api item objects
     */
    ZabbixAPIDatasource.prototype.performTimeSeriesQuery = function(items, start, end) {
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

        return this.performZabbixAPIRequest('history.get', params);
      }, this)).then(function (results) {
        return _.flatten(results);
      });
    };


    // Convert Zabbix API data to Grafana format
    ZabbixAPIDatasource.prototype.handleZabbixAPIResponse = function(items, response) {
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

      // Group items and history by itemid
      var indexed_items = _.indexBy(items, 'itemid');
      var grouped_history = _.groupBy(response, 'itemid');

      return $q.when(_.map(grouped_history, function (history, itemid) {
        var series = {
          target: expandItemName(indexed_items[itemid]),
          datapoints: _.map(history, function (p) {
            // Value must be a number for properly work
            var value = Number(p.value);
            return [value, p.clock * 1000];
          })
        };
        return series;
      }));
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
        output: ['name', 'host'],
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


    ZabbixAPIDatasource.prototype.findZabbixGroup = function (group) {
      var params = {
        output: ['name'],
        search: {
          name: group
        },
        searchWildcardsEnabled: true
      }
      return this.performZabbixAPIRequest('hostgroup.get', params);
    };


    ZabbixAPIDatasource.prototype.findZabbixHost = function (hostname) {
      var params = {
        output: ['host', 'name'],
        search: {
          host: hostname,
          name: hostname
        },
        searchWildcardsEnabled: true,
        searchByAny: true
      }
      return this.performZabbixAPIRequest('host.get', params);
    };


    ZabbixAPIDatasource.prototype.findZabbixApp = function (application) {
      var params = {
        output: ['name'],
        search: {
          name: application
        },
        searchWildcardsEnabled: true,
      }
      return this.performZabbixAPIRequest('application.get', params);
    };


    ZabbixAPIDatasource.prototype.findZabbixItem = function (host, itemnames) {
      var params = {
        output: ['name', 'key_', 'value_type'],
        host: host
      }
      return this.performZabbixAPIRequest('item.get', params).then(function (items) {
        return _.filter(items, function (item) {
          return _.contains(itemnames, expandItemName(item));
        });
      });
    };


    // For templated query
    ZabbixAPIDatasource.prototype.metricFindQuery = function (query) {
      // Split query. Query structure:
      // group.host.app.key
      var parts = [];
      _.each(query.split('.'), function (part) {
        part = templateSrv.replace(part);
        if (part[0] === '{') {
          // Convert multiple mettrics to array
          // "{metric1,metcic2,...,metricN}" --> [metric1, metcic2,..., metricN]
          parts.push(part.slice(1, -1).split(','));
        } else {
          parts.push(part);
        }
      });
      var template = _.object(['group', 'host', 'app', 'key'], parts)

      var params = {
        output: ['name'],
        sortfield: 'name',
        // Case insensitive search
        search: {
          name : template.group
        }
      };

      // Get items
      if (parts.length === 4) {
        return this.itemFindQuery(template);
      }
      // Get applications
      else if (parts.length === 3) {
        return this.appFindQuery(template);
      }
      // Get hosts
      else if (parts.length === 2) {
        return this.hostFindQuery(template);
      }
      // Get groups
      else if (parts.length === 1) {
        return this.groupFindQuery(template);
      }
      // Return empty object
      else {
        var d = $q.defer();
        d.resolve([]);
        return d.promise;
      }
    };


    ZabbixAPIDatasource.prototype.itemFindQuery = function(template) {
      var promises = [];

      // Get hostids from names
      if (template.host && template.host != '*') {
        if (_.isArray(template.host)) {
          _.each(template.host, function (host) {
            promises.push(this.findZabbixHost(host));
          }, this);
        } else {
          promises.push(this.findZabbixHost(template.host));
        }
      }
      // Get groupids from names
      else if (template.group && template.group != '*') {
        if (_.isArray(template.group)) {
          _.each(template.group, function (group) {
            promises.push(this.findZabbixGroup(group));
          }, this);
        } else {
          promises.push(this.findZabbixGroup(template.group));
        }
      }
      // Get applicationids from names
      if (template.app && template.app != '*') {
        if (_.isArray(template.app)) {
          _.each(template.app, function (app) {
            promises.push(this.findZabbixApp(app));
          }, this);
        } else {
          promises.push(this.findZabbixApp(template.app));
        }
      }

      var self = this;
      return $q.all(promises).then(function (results) {
        results = _.flatten(results);
        var groupids = _.map(_.filter(results, function (object) {
          return object.groupid;
        }), 'groupid');
        var hostids = _.map(_.filter(results, function (object) {
          return object.hostid;
        }), 'hostid');
        var applicationids = _.map(_.filter(results, function (object) {
          return object.applicationid;
        }), 'applicationid');

        var params = {
          output: ['name', 'key_'],
          sortfield: 'name',
        };
        if (applicationids.length) {
          params.applicationids = applicationids;
        }
        if (hostids.length) {
          params.hostids = hostids;
        } else if (groupids.length) {
          params.groupids = groupids;
        }
        return self.performZabbixAPIRequest('item.get', params)
          .then(function (result) {
            return _.map(result, function (item) {
              return {
                //text: item.key_,
                text: expandItemName(item),
                expandable: false
              };
            });
          });
      });
    };


    ZabbixAPIDatasource.prototype.appFindQuery = function(template) {
      var promises = [];

      // Get groupids from names
      if (template.group != '*' && template.group) {
        if (_.isArray(template.group)) {
          _.each(template.group, function (group) {
            promises.push(this.findZabbixGroup(group));
          }, this);
        } else {
          promises.push(this.findZabbixGroup(template.group));
        }
      }
      // Get hostids from names
      if (template.host != '*' && template.host) {
        if (_.isArray(template.host)) {
          _.each(template.host, function (host) {
            promises.push(this.findZabbixHost(host));
          }, this);
        } else {
          promises.push(this.findZabbixHost(template.host));
        }
      }

      var self = this;
      return $q.all(promises).then(function (results) {
        results = _.flatten(results);
        var groupids = _.map(_.filter(results, function (object) {
          return object.groupid;
        }), 'groupid');
        var hostids = _.map(_.filter(results, function (object) {
          return object.hostid;
        }), 'hostid');

        var params = {
          output: ['name'],
          sortfield: 'name'
        }
        if (hostids.length) {
          params.hostids = hostids;
        } else if (groupids.length) {
          params.groupids = groupids;
        }

        return self.performZabbixAPIRequest('application.get', params)
          .then(function (result) {
            return _.map(result, function (app) {
              return {
                text: app.name,
                expandable: false
              };
            });
          });
      });
    };


    ZabbixAPIDatasource.prototype.hostFindQuery = function(template) {
      var promises = [];

      // Get groupids from names
      if (template.group != '*' && template.group) {
        if (_.isArray(template.group)) {
          _.each(template.group, function (group) {
            promises.push(this.findZabbixGroup(group));
          }, this);
        } else {
          promises.push(this.findZabbixGroup(template.group));
        }
      }

      var self = this;
      return $q.all(promises).then(function (results) {
        results = _.flatten(results);
        var groupids = _.map(_.filter(results, function (object) {
          return object.groupid;
        }), 'groupid');

        var params = {
          output: ['name', 'host'],
          sortfield: 'name'
        }
        if (groupids.length) {
          params.groupids = groupids;
        }

        return self.performZabbixAPIRequest('host.get', params)
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


    ZabbixAPIDatasource.prototype.groupFindQuery = function(template) {
      var promises = [];

      // Get groupids from names
      if (_.isArray(template.group)) {
        _.each(template.group, function (group) {
          promises.push(this.findZabbixGroup(group));
        }, this);
      } else {
        promises.push(this.findZabbixGroup(template.group));
      }

      var self = this;
      return $q.all(promises).then(function (results) {
        results = _.flatten(results);
        var groupids = _.map(_.filter(results, function (object) {
          return object.groupid;
        }), 'groupid');

        var params = {
          output: ['name', 'host'],
          sortfield: 'name'
        }
        if (groupids.length) {
          params.groupids = groupids;
        }

        return self.performZabbixAPIRequest('hostgroup.get', params)
          .then(function (result) {
            return _.map(result, function (hostgroup) {
              return {
                text: hostgroup.name,
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


/**
 * Expand item parameters, for example:
 * CPU $2 time ($3) --> CPU system time (avg1)
 *
 * @param item: zabbix api item object
 * @return: expanded item name (string)
 */
function expandItemName(item) {
  var name = item.name;
  var key = item.key_;

  // extract params from key:
  // "system.cpu.util[,system,avg1]" --> ["", "system", "avg1"]
  var key_params = key.substring(key.indexOf('[') + 1, key.lastIndexOf(']')).split(',');

  // replace item parameters
  for (var i = key_params.length; i >= 1; i--) {
    name = name.replace('$' + i, key_params[i - 1]);
  };
  return name;
};