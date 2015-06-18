define([
  'angular',
  'lodash',
  'kbn',
  './queryCtrl'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ZabbixAPIDatasource', function($q, backendSrv, templateSrv) {

    /**
     * Datasource initialization. Calls when you refresh page, add
     * or modify datasource.
     *
     * @param {Object} datasource Grafana datasource object.
     */
    function ZabbixAPIDatasource(datasource) {
      this.name             = datasource.name;
      this.url              = datasource.url;

      // TODO: fix passing username and password from config.html
      this.username         = datasource.meta.username;
      this.password         = datasource.meta.password;

      // Use trends instead history since specified time
      this.trendsFrom = datasource.meta.trendsFrom || '7d';

      // Limit metrics per panel for templated request
      this.limitmetrics = datasource.meta.limitmetrics || 50;
    }


    /**
     * Calls for each panel in dashboard.
     *
     * @param  {Object} options   Query options. Contains time range, targets
     *                            and other info.
     *
     * @return {Object}           Grafana metrics object with timeseries data
     *                            for each target.
     */
    ZabbixAPIDatasource.prototype.query = function(options) {

      // get from & to in seconds
      var from = Math.ceil(kbn.parseDate(options.range.from).getTime() / 1000);
      var to = Math.ceil(kbn.parseDate(options.range.to).getTime() / 1000);
      var useTrendsFrom = Math.ceil(kbn.parseDate('now-' + this.trendsFrom).getTime() / 1000);

      // Create request for each target
      var promises = _.map(options.targets, function(target) {

        // Don't show undefined and hidden targets
        if (target.hide || !target.group || !target.host
                        || !target.application || !target.item) {
          return [];
        }

        // Replace templated variables
        var groupname = templateSrv.replace(target.group.name);
        var hostname  = templateSrv.replace(target.host.name);
        var appname   = templateSrv.replace(target.application.name);
        var itemname  = templateSrv.replace(target.item.name);

        // Extract zabbix groups, hosts and apps from string:
        // "{host1,host2,...,hostN}" --> [host1, host2, ..., hostN]
        var groups = splitMetrics(groupname);
        var hosts  = splitMetrics(hostname);
        var apps   = splitMetrics(appname);

        // Remove hostnames from item names and then
        // extract item names
        // "hostname: itemname" --> "itemname"
        var delete_hostname_pattern = /(?:\[[\w\.]+\]\:\s)/g;
        var itemnames = splitMetrics(itemname.replace(delete_hostname_pattern, ''));

        // Find items by item names and perform queries
        var self = this;
        return this.itemFindQuery(groups, hosts, apps)
          .then(function (items) {
            if (itemnames == 'All') {
              return items;
            } else {

              // Filtering items
              return _.filter(items, function (item) {
                return _.contains(itemnames, expandItemName(item));
              });
            }
          }).then(function (items) {

            // Don't perform query for high number of items
            // to prevent Grafana slowdown
            if (items.length > self.limitmetrics) {
              return [];
            } else {
              items = _.flatten(items);

              if (from > useTrendsFrom) {
                return self.performTimeSeriesQuery(items, from, to)
                    .then(_.partial(self.handleHistoryResponse, items));
              } else {
                return self.getTrends(items, from, to)
                  .then(_.partial(self.handleTrendResponse, items));
              }
            }
          });
      }, this);

      return $q.all(_.flatten(promises)).then(function (results) {
        return { data: _.flatten(results) };
      });
    };


    /**
     * Perform history query from Zabbix API
     *
     * @param  {Array}  items Array of Zabbix item objects
     * @param  {Number} start Time in seconds
     * @param  {Number} end   Time in seconds
     *
     * @return {Array}        Array of Zabbix history objects
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


    ZabbixAPIDatasource.prototype.getTrends = function(items, start, end) {
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

        return this.performZabbixAPIRequest('trend.get', params);
      }, this)).then(function (results) {
        return _.flatten(results);
      });
    };


    ZabbixAPIDatasource.prototype.handleTrendResponse = function(items, trends) {

      // Group items and trends by itemid
      var indexed_items = _.indexBy(items, 'itemid');
      var grouped_history = _.groupBy(trends, 'itemid');

      return $q.when(_.map(grouped_history, function (trends, itemid) {
        var item = indexed_items[itemid];
        var series = {
          target: (item.hosts ? item.hosts[0].name+': ' : '') + expandItemName(item),
          datapoints: _.map(trends, function (p) {

            // Value must be a number for properly work
            var value = Number(p.value_avg);
            return [value, p.clock * 1000];
          })
        };
        return series;
      })).then(function (result) {
        return _.sortBy(result, 'target');
      });
    };


    /**
     * Convert Zabbix API data to Grafana format
     *
     * @param  {Array} items      Array of Zabbix Items
     * @param  {Array} history    Array of Zabbix History
     *
     * @return {Array}            Array of timeseries in Grafana format
     *                            {
     *                               target: "Metric name",
     *                               datapoints: [[<value>, <unixtime>], ...]
     *                            }
     */
    ZabbixAPIDatasource.prototype.handleHistoryResponse = function(items, history) {
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
      var grouped_history = _.groupBy(history, 'itemid');

      return $q.when(_.map(grouped_history, function (history, itemid) {
        var item = indexed_items[itemid];
        var series = {
          target: (item.hosts ? item.hosts[0].name+': ' : '') + expandItemName(item),
          datapoints: _.map(history, function (p) {

            // Value must be a number for properly work
            var value = Number(p.value);
            return [value, p.clock * 1000];
          })
        };
        return series;
      })).then(function (result) {
        return _.sortBy(result, 'target');
      });
    };


    /**
     * Request data from Zabbix API
     *
     * @param  {string} method Zabbix API method name
     * @param  {object} params method params
     *
     * @return {object}        data.result field or []
     */
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

      var self = this;
      return backendSrv.datasourceRequest(options).then(function (response) {
        if (!response.data) {
          return [];
        }
        // Handle Zabbix API errors
        else if (response.data.error) {

          // Handle auth errors
          if (response.data.error.data == "Session terminated, re-login, please." ||
              response.data.error.data == 'Not authorised.') {
            return self.performZabbixAPILogin().then(function (response) {
              self.auth = response;
              return self.performZabbixAPIRequest(method, params);
            });
          }
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
        sortfield: 'name',
        // Return only host groups that contain hosts
        real_hosts: true,
        // Return only host groups that contain monitored hosts.
        monitored_hosts: true
      };

      return this.performZabbixAPIRequest('hostgroup.get', params);
    };


    // Get the list of hosts
    ZabbixAPIDatasource.prototype.performHostSuggestQuery = function(groupids) {
      var params = {
        output: ['name', 'host'],
        sortfield: 'name',
        // Return only hosts that have items with numeric type of information.
        with_simple_graph_items: true,
        // Return only monitored hosts.
        monitored_hosts: true
      };
      // Return only hosts in given group
      if (groupids) {
        params.groupids = groupids;
      }
      return this.performZabbixAPIRequest('host.get', params);
    };


    // Get the list of applications
    ZabbixAPIDatasource.prototype.performAppSuggestQuery = function(hostids, /* optional */ groupids) {
      var params = {
        output: ['name'],
        sortfield: 'name'
      };
      if (hostids) {
        params.hostids = hostids;
      }
      else if (groupids) {
        params.groupids = groupids;
      }

      return this.performZabbixAPIRequest('application.get', params);
    };


    /**
     * Items request
     *
     * @param  {string or Array} hostids          ///////////////////////////
     * @param  {string or Array} applicationids   // Zabbix API parameters //
     * @param  {string or Array} groupids         ///////////////////////////
     *
     * @return {string or Array}                  Array of Zabbix API item objects
     */
    ZabbixAPIDatasource.prototype.performItemSuggestQuery = function(hostids, applicationids, /* optional */ groupids) {
      var params = {
        output: ['name', 'key_', 'value_type', 'delay'],
        sortfield: 'name',
        //Include web items in the result
        webitems: true,
        // Return only numeric items
        filter: {
          value_type: [0,3]
        },
        // Return only enabled items
        monitored: true,
        searchByAny: true
      };

      // Filter by hosts or by groups
      if (hostids) {
        params.hostids = hostids;
      } else if (groupids) {
        params.groupids = groupids;
      }

      // If application selected return only relative items
      if (applicationids) {
        params.applicationids = applicationids;
      }

      // Return host property for multiple hosts
      if (!hostids || (_.isArray(hostids) && hostids.length  > 1)) {
        params.selectHosts = ['name'];
      }

      return this.performZabbixAPIRequest('item.get', params);
    };


    /**
     * Find groups by names
     *
     * @param  {string or array} group group names
     * @return {array}                 array of Zabbix API hostgroup objects
     */
    ZabbixAPIDatasource.prototype.findZabbixGroup = function (group) {
      var params = {
        output: ['name'],
        search: {
          name: group
        },
        searchByAny: true,
        searchWildcardsEnabled: true
      }
      return this.performZabbixAPIRequest('hostgroup.get', params);
    };


    /**
     * Find hosts by names
     *
     * @param  {string or array} hostnames hosts names
     * @return {array}                     array of Zabbix API host objects
     */
    ZabbixAPIDatasource.prototype.findZabbixHost = function (hostnames) {
      var params = {
        output: ['host', 'name'],
        search: {
          host: hostnames,
          name: hostnames
        },
        searchByAny: true,
        searchWildcardsEnabled: true
      }
      return this.performZabbixAPIRequest('host.get', params);
    };


    /**
     * Find applications by names
     *
     * @param  {string or array} application applications names
     * @return {array}                       array of Zabbix API application objects
     */
    ZabbixAPIDatasource.prototype.findZabbixApp = function (application) {
      var params = {
        output: ['name'],
        search: {
          name: application
        },
        searchByAny: true,
        searchWildcardsEnabled: true,
      }
      return this.performZabbixAPIRequest('application.get', params);
    };


    /**
     * For templated query.
     * Find metrics from templated request.
     *
     * @param  {string} query Query from Templating
     * @return {string}       Metric name - group, host, app or item or list
     *                        of metrics in "{metric1,metcic2,...,metricN}" format.
     */
    ZabbixAPIDatasource.prototype.metricFindQuery = function (query) {
      // Split query. Query structure:
      // group.host.app.item
      var parts = [];
      _.each(query.split('.'), function (part) {
        part = templateSrv.replace(part);
        if (part[0] === '{') {
          // Convert multiple mettrics to array
          // "{metric1,metcic2,...,metricN}" --> [metric1, metcic2,..., metricN]
          parts.push(splitMetrics(part));
        } else {
          parts.push(part);
        }
      });
      var template = _.object(['group', 'host', 'app', 'item'], parts)

      // Get items
      if (parts.length === 4) {
        return this.itemFindQuery(template.group, template.host, template.app).then(function (result) {
          return _.map(result, function (item) {
            var itemname = expandItemName(item)
            return {
              text: itemname,
              expandable: false
            };
          });
        });
      }
      // Get applications
      else if (parts.length === 3) {
        return this.appFindQuery(template.host, template.group).then(function (result) {
          return _.map(result, function (app) {
            return {
              text: app.name,
              expandable: false
            };
          });
        });
      }
      // Get hosts
      else if (parts.length === 2) {
        return this.hostFindQuery(template.group).then(function (result) {
          return _.map(result, function (host) {
            return {
              text: host.name,
              expandable: false
            };
          });
        });
      }
      // Get groups
      else if (parts.length === 1) {
        return this.performHostGroupSuggestQuery().then(function (result) {
          return _.map(result, function (hostgroup) {
            return {
              text: hostgroup.name,
              expandable: false
            };
          });
        });
      }
      // Return empty object for invalid request
      else {
        var d = $q.defer();
        d.resolve([]);
        return d.promise;
      }
    };


    /**
     * Find items belongs to passed groups, hosts and
     * applications
     *
     * @param  {string or array} groups
     * @param  {string or array} hosts
     * @param  {string or array} apps
     *
     * @return {array}  array of Zabbix API item objects
     */
    ZabbixAPIDatasource.prototype.itemFindQuery = function(groups, hosts, apps) {
      var promises = [];

      // Get hostids from names
      if (hosts && hosts != '*') {
        promises.push(this.findZabbixHost(hosts));
      }
      // Get groupids from names
      else if (groups) {
        promises.push(this.findZabbixGroup(groups));
      }
      // Get applicationids from names
      if (apps) {
        promises.push(this.findZabbixApp(apps));
      }

      var self = this;
      return $q.all(promises).then(function (results) {
        results = _.flatten(results);
        if (groups) {
          var groupids = _.map(_.filter(results, function (object) {
            return object.groupid;
          }), 'groupid');
        }
        if (hosts && hosts != '*') {
          var hostids = _.map(_.filter(results, function (object) {
            return object.hostid;
          }), 'hostid');
        }
        if (apps) {
          var applicationids = _.map(_.filter(results, function (object) {
            return object.applicationid;
          }), 'applicationid');
        }

        return self.performItemSuggestQuery(hostids, applicationids, groupids);
      });
    };


    /**
     * Find applications belongs to passed groups and hosts
     *
     * @param  {string or array} hosts
     * @param  {string or array} groups
     *
     * @return {array}  array of Zabbix API application objects
     */
    ZabbixAPIDatasource.prototype.appFindQuery = function(hosts, groups) {
      var promises = [];

      // Get hostids from names
      if (hosts && hosts != '*') {
        promises.push(this.findZabbixHost(hosts));
      }
      // Get groupids from names
      else if (groups) {
        promises.push(this.findZabbixGroup(groups));
      }

      var self = this;
      return $q.all(promises).then(function (results) {
        results = _.flatten(results);
        if (groups) {
          var groupids = _.map(_.filter(results, function (object) {
            return object.groupid;
          }), 'groupid');
        }
        if (hosts && hosts != '*') {
          var hostids = _.map(_.filter(results, function (object) {
            return object.hostid;
          }), 'hostid');
        }

        return self.performAppSuggestQuery(hostids, groupids);
      });
    };


    /**
     * Find hosts belongs to passed groups
     *
     * @param  {string or array} groups
     * @return {array}  array of Zabbix API host objects
     */
    ZabbixAPIDatasource.prototype.hostFindQuery = function(groups) {
      var self = this;
      return this.findZabbixGroup(groups).then(function (results) {
        results = _.flatten(results);
        var groupids = _.map(_.filter(results, function (object) {
          return object.groupid;
        }), 'groupid');

        return self.performHostSuggestQuery(groupids);
      });
    };


    /////////////////
    // Annotations //
    /////////////////


    ZabbixAPIDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      var from = Math.ceil(kbn.parseDate(rangeUnparsed.from).getTime() / 1000);
      var to = Math.ceil(kbn.parseDate(rangeUnparsed.to).getTime() / 1000);
      var self = this;

      var params = {
        output: ['triggerid', 'description'],
        search: {
          'description': annotation.query
        },
        searchWildcardsEnabled: true,
        expandDescription: true
      };

      return this.performZabbixAPIRequest('trigger.get', params)
        .then(function (result) {
          if(result) {
            var objects = _.indexBy(result, 'triggerid');
            var params = {
              output: 'extend',
              time_from: from,
              time_till: to,
              objectids: _.keys(objects),
              select_acknowledges: 'extend'
            };

            // Show problem events only
            if (!annotation.showOkEvents) {
              params.value = 1;
            }

            return self.performZabbixAPIRequest('event.get', params)
              .then(function (result) {
                var events = [];
                _.each(result, function(e) {
                  var formatted_acknowledges = formatAcknowledges(e.acknowledges);;
                  events.push({
                    annotation: annotation,
                    time: e.clock * 1000,
                    title: Number(e.value) ? 'Problem' : 'OK',
                    text: objects[e.objectid].description + formatted_acknowledges,
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
 * Convert multiple mettrics to array
 * "{metric1,metcic2,...,metricN}" --> [metric1, metcic2,..., metricN]
 *
 * @param  {string} metrics   "{metric1,metcic2,...,metricN}"
 * @return {Array}            [metric1, metcic2,..., metricN]
 */
function splitMetrics(metrics) {
  var remove_brackets_pattern = /^{|}$/g;
  var metric_split_pattern = /,(?!\s)/g;
  return metrics.replace(remove_brackets_pattern, '').split(metric_split_pattern)
}


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
}


/**
 * Convert Date object to local time in format
 * YYYY-MM-DD HH:mm:ss
 *
 * @param  {Date} date Date object
 * @return {string} formatted local time YYYY-MM-DD HH:mm:ss
 */
function getShortTime(date) {
  var MM = date.getMonth() < 10 ? '0' + date.getMonth() : date.getMonth();
  var DD = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
  var HH = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
  var mm = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
  var ss = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();
  return date.getFullYear() + '-' + MM + '-' + DD + ' ' + HH + ':' + mm + ':' + ss;
}


/**
 * Format acknowledges.
 *
 * @param  {array} acknowledges array of Zabbix acknowledge objects
 * @return {string} HTML-formatted table
 */
function formatAcknowledges(acknowledges) {
  if (acknowledges.length) {
    var formatted_acknowledges = '<br><br>Acknowledges:<br><table><tr><td><b>Time</b></td><td><b>User</b></td><td><b>Comments</b></td></tr>';
    _.each(_.map(acknowledges, function (ack) {
      var time = new Date(ack.clock * 1000);
      return '<tr><td><i>' + getShortTime(time) + '</i></td><td>' + ack.alias + ' (' + ack.name+ ' ' + ack.surname + ')' + '</td><td>' + ack.message + '</td></tr>';
    }), function (ack) {
      formatted_acknowledges = formatted_acknowledges.concat(ack)
    });
    formatted_acknowledges = formatted_acknowledges.concat('</table>')
    return formatted_acknowledges;
  } else {
    return '';
  }
}