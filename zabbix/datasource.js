define([
  'angular',
  'lodash',
  'kbn',
  './zabbixAPIWrapper',
  './queryCtrl'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ZabbixAPIDatasource', function($q, backendSrv, templateSrv, zabbix) {

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
      this.trends = datasource.meta.trends;
      this.trendsFrom = datasource.meta.trendsFrom || '7d';

      // Limit metrics per panel for templated request
      this.limitmetrics = datasource.meta.limitmetrics || 50;

      // Initialize Zabbix API
      zabbix.init(this.url, this.username, this.password);
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
        return zabbix.itemFindQuery(groups, hosts, apps)
          .then(function (items) {

            // Filter hosts by regex
            if (target.host.visible_name == 'All') {
              if (target.hostFilter && _.every(items, _.identity.hosts)) {
                var host_pattern = new RegExp(target.hostFilter);
                items = _.filter(items, function (item) {
                  return _.some(item.hosts, function (host) {
                    return host_pattern.test(host.name);
                  });
                });
              }
            }

            if (itemnames == 'All') {

              // Filter items by regex
              if (target.itemFilter) {
                var item_pattern = new RegExp(target.itemFilter);
                return _.filter(items, function (item) {
                  return item_pattern.test(zabbix.expandItemName(item));
                });
              } else {
                return items;
              }
            } else {

              // Filtering items
              return _.filter(items, function (item) {
                return _.contains(itemnames, zabbix.expandItemName(item));
              });
            }
          }).then(function (items) {

            // Don't perform query for high number of items
            // to prevent Grafana slowdown
            if (items.length > self.limitmetrics) {
              return [];
            } else {
              items = _.flatten(items);
              var alias = target.item.name === 'All' ? undefined : templateSrv.replace(target.alias);

              if ((from < useTrendsFrom) && self.trends) {
                return zabbix.getTrends(items, from, to)
                  .then(_.partial(self.handleTrendResponse, items, alias, target.scale));
              } else {
                return zabbix.getHistory(items, from, to)
                  .then(_.partial(self.handleHistoryResponse, items, alias, target.scale));
              }
            }
          });
      }, this);

      return $q.all(_.flatten(promises)).then(function (results) {
        return { data: _.flatten(results) };
      });
    };


    ZabbixAPIDatasource.prototype.handleTrendResponse = function(items, alias, scale, trends) {

      // Group items and trends by itemid
      var indexed_items = _.indexBy(items, 'itemid');
      var grouped_history = _.groupBy(trends, 'itemid');

      return $q.when(_.map(grouped_history, function (trends, itemid) {
        var item = indexed_items[itemid];
        var series = {
          target: (item.hosts ? item.hosts[0].name+': ' : '') + (alias ? alias : zabbix.expandItemName(item)),
          datapoints: _.map(trends, function (p) {

            // Value must be a number for properly work
            var value = Number(p.value_avg);

            // Apply scale
            if (scale) {
              value *= scale;
            }
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
    ZabbixAPIDatasource.prototype.handleHistoryResponse = function(items, alias, scale, history) {
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
          target: (item.hosts ? item.hosts[0].name+': ' : '') + (alias ? alias : zabbix.expandItemName(item)),
          datapoints: _.map(history, function (p) {

            // Value must be a number for properly work
            var value = Number(p.value);

            // Apply scale
            if (scale) {
              value *= scale;
            }
            return [value, p.clock * 1000];
          })
        };
        return series;
      })).then(function (result) {
        return _.sortBy(result, 'target');
      });
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
        return zabbix.itemFindQuery(template.group, template.host, template.app).then(function (result) {
          return _.map(result, function (item) {
            var itemname = zabbix.expandItemName(item)
            return {
              text: itemname,
              expandable: false
            };
          });
        });
      }
      // Get applications
      else if (parts.length === 3) {
        return zabbix.appFindQuery(template.host, template.group).then(function (result) {
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
        return zabbix.hostFindQuery(template.group).then(function (result) {
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
        return zabbix.findZabbixGroup(template.group).then(function (result) {
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
