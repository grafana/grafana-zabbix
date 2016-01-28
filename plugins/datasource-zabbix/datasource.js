define([
  'angular',
  'lodash',
  'app/core/utils/datemath',
  './utils',
  './metricFunctions',
  './queryProcessor',
  './directives',
  './zabbixAPI',
  './helperFunctions',
  './dataProcessingService',
  './zabbixCache',
  './queryCtrl',
  './addMetricFunction',
  './metricFunctionEditor'
],
function (angular, _, dateMath, utils, metricFunctions) {
  'use strict';

  /** @ngInject */
  function ZabbixAPIDatasource(instanceSettings, $q, templateSrv, alertSrv, zabbixHelperSrv,
                               ZabbixAPI, ZabbixCache, QueryProcessor, DataProcessingService) {

    // General data source settings
    this.name             = instanceSettings.name;
    this.url              = instanceSettings.url;
    this.basicAuth        = instanceSettings.basicAuth;
    this.withCredentials  = instanceSettings.withCredentials;

    // Zabbix API credentials
    this.username         = instanceSettings.jsonData.username;
    this.password         = instanceSettings.jsonData.password;

    // Use trends instead history since specified time
    this.trends           = instanceSettings.jsonData.trends;
    this.trendsFrom       = instanceSettings.jsonData.trendsFrom || '7d';

    // Initialize Zabbix API
    this.zabbixAPI = new ZabbixAPI(this.url, this.username, this.password, this.basicAuth, this.withCredentials);

    // Initialize cache service
    this.zabbixCache = new ZabbixCache(this.zabbixAPI);

    // Initialize query builder
    this.queryProcessor = new QueryProcessor(this.zabbixCache);

    console.log(this.zabbixCache);

    ////////////////////////
    // Datasource methods //
    ////////////////////////

    /**
     * Test connection to Zabbix API
     * @return {object} Connection status and Zabbix API version
     */
    this.testDatasource = function() {
      var self = this;
      return this.zabbixAPI.getVersion().then(function (version) {
        return self.zabbixAPI.login().then(function (auth) {
          if (auth) {
            return {
              status: "success",
              title: "Success",
              message: "Zabbix API version: " + version
            };
          } else {
            return {
              status: "error",
              title: "Invalid user name or password",
              message: "Zabbix API version: " + version
            };
          }
        }, function(error) {
          console.log(error);
          return {
            status: "error",
            title: "Connection failed",
            message: error
          };
        });
      },
      function(error) {
        console.log(error);
        return {
          status: "error",
          title: "Connection failed",
          message: "Could not connect to given url"
        };
      });
    };

    /**
     * Query panel data. Calls for each panel in dashboard.
     * @param  {Object} options   Contains time range, targets and other info.
     * @return {Object} Grafana metrics object with timeseries data for each target.
     */
    this.query = function(options) {
      var self = this;

      // get from & to in seconds
      var from = Math.ceil(dateMath.parse(options.range.from) / 1000);
      var to = Math.ceil(dateMath.parse(options.range.to) / 1000);
      var useTrendsFrom = Math.ceil(dateMath.parse('now-' + this.trendsFrom) / 1000);

      // Create request for each target
      var promises = _.map(options.targets, function(target) {

        if (target.mode !== 1) {

          // Don't show hidden targets
          if (target.hide) {
            return [];
          }

          // Replace templated variables
          var groupFilter = templateSrv.replace(target.group.filter, options.scopedVars);
          var hostFilter = templateSrv.replace(target.host.filter, options.scopedVars);
          var appFilter = templateSrv.replace(target.application.filter, options.scopedVars);
          var itemFilter = templateSrv.replace(target.item.filter, options.scopedVars);

          // Query numeric data
          if (!target.mode || target.mode === 0) {

            var items = self.queryProcessor.build(groupFilter, hostFilter, appFilter, itemFilter);

            // Add hostname for items from multiple hosts
            var addHostName = target.host.isRegex;

            var getHistory;
            if ((from < useTrendsFrom) && self.trends) {

              // Use trends
              var valueType = target.downsampleFunction ? target.downsampleFunction.value : "avg";
              getHistory = self.zabbixAPI.getTrends(items, from, to).then(function(history) {
                return self.queryProcessor.handleTrends(history, addHostName, valueType);
              });
            } else {

              // Use history
              getHistory = self.zabbixAPI.getHistory(items, from, to).then(function(history) {
                return self.queryProcessor.handleHistory(history, addHostName);
              });
            }

            return getHistory.then(function (timeseries_data) {
              timeseries_data = _.map(timeseries_data, function (timeseries) {

                // Filter only transform functions
                var transformFunctions = _.map(metricFunctions.getCategories()['Transform'], 'name');
                var transFuncDefs = _.filter(target.functions, function(func) {
                  return _.contains(transformFunctions, func.def.name);
                });
                var functions = _.map(transFuncDefs, function(func) {
                  var funcInstance = metricFunctions.createFuncInstance(func.def, func.params);
                  return funcInstance.bindFunction(DataProcessingService.metricFunctions);
                });

                // Metric data processing
                var dp = timeseries.datapoints;
                for (var i = 0; i < functions.length; i++) {
                  dp = functions[i](dp);
                }
                timeseries.datapoints = dp;

                return timeseries;
              });

              // Aggregations
              var aggregationFunctions = _.map(metricFunctions.getCategories()['Aggregate'], 'name');
              var aggFuncDefs = _.filter(target.functions, function(func) {
                return _.contains(aggregationFunctions, func.def.name);
              });
              var functions = _.map(aggFuncDefs, function(func) {
                var funcInstance = metricFunctions.createFuncInstance(func.def, func.params);
                return funcInstance.bindFunction(DataProcessingService.metricFunctions);
              });
              var dp = _.map(timeseries_data, 'datapoints');

              if (functions.length) {
                for (var i = 0; i < functions.length; i++) {
                  dp = functions[i](dp);
                }
                timeseries_data = {
                  target: 'agg',
                  datapoints: dp
                };
              }
              return timeseries_data;
            });
          }

          // Query text data
          else if (target.mode === 2) {

            // Find items by item names and perform queries
            return this.zabbixAPI.itemFindQuery(groups, hosts, apps, "text")
              .then(function (items) {
                items = _.filter(items, function (item) {
                  return _.contains(itemnames, zabbixHelperSrv.expandItemName(item));
                });
                return self.zabbixAPI.getHistory(items, from, to).then(function(history) {
                  return {
                    target: target.item.name,
                    datapoints: _.map(history, function (p) {
                      var value = p.value;
                      if (target.textFilter) {
                        var text_extract_pattern = new RegExp(templateSrv.replace(target.textFilter, options.scopedVars));
                        //var text_extract_pattern = new RegExp(target.textFilter);
                        var result = text_extract_pattern.exec(value);
                        if (result) {
                          if (target.useCaptureGroups) {
                            value = result[1];
                          } else {
                            value = result[0];
                          }
                        } else {
                          value = null;
                        }
                      }
                      return [value, p.clock * 1000];
                    })
                  };
                });
              });
          }
        }

        // IT services mode
        else if (target.mode === 1) {
          // Don't show undefined and hidden targets
          if (target.hide || !target.itservice || !target.slaProperty) {
            return [];
          } else {
            return this.zabbixAPI.getSLA(target.itservice.serviceid, from, to)
              .then(_.bind(zabbixHelperSrv.handleSLAResponse, zabbixHelperSrv, target.itservice, target.slaProperty));
          }
        }
      }, this);

      // Data for panel (all targets)
      return $q.all(_.flatten(promises))
        .then(_.flatten)
        .then(function (timeseries_data) {

          // Series downsampling
          var data = _.map(timeseries_data, function(timeseries) {
            var DPS = DataProcessingService;
            if (timeseries.datapoints.length > options.maxDataPoints) {
              timeseries.datapoints = DPS.groupBy(options.interval, DPS.AVERAGE, timeseries.datapoints);
            }
            return timeseries;
          });
          return { data: data };
        });
    };

    ////////////////
    // Templating //
    ////////////////

    /**
     * Find metrics from templated request.
     *
     * @param  {string} query Query from Templating
     * @return {string}       Metric name - group, host, app or item or list
     *                        of metrics in "{metric1,metcic2,...,metricN}" format.
     */
    this.metricFindQuery = function (query) {
      // Split query. Query structure:
      // group.host.app.item
      var parts = [];
      _.each(query.split('.'), function (part) {
        part = templateSrv.replace(part);
        if (part[0] === '{') {
          // Convert multiple mettrics to array
          // "{metric1,metcic2,...,metricN}" --> [metric1, metcic2,..., metricN]
          parts.push(zabbixHelperSrv.splitMetrics(part));
        } else {
          parts.push(part);
        }
      });
      var template = _.object(['group', 'host', 'app', 'item'], parts);

      // Get items
      if (parts.length === 4) {
        return this.zabbixAPI.itemFindQuery(template.group, template.host, template.app)
          .then(function (result) {
            return _.map(result, function (item) {
              var itemname = zabbixHelperSrv.expandItemName(item);
              return {
                text: itemname,
                expandable: false
              };
            });
          });
      }
      // Get applications
      else if (parts.length === 3) {
        return this.zabbixAPI.appFindQuery(template.host, template.group).then(function (result) {
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
        return this.zabbixAPI.hostFindQuery(template.group).then(function (result) {
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
        return this.zabbixAPI.getGroupByName(template.group).then(function (result) {
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

    this.annotationQuery = function(options) {
      var from = Math.ceil(dateMath.parse(options.rangeRaw.from) / 1000);
      var to = Math.ceil(dateMath.parse(options.rangeRaw.to) / 1000);
      var annotation = annotation;
      var self = this;

      // Remove events below the chose severity
      var severities = [];
      for (var i = 5; i >= annotation.minseverity; i--) {
        severities.push(i);
      }
      var params = {
        output: ['triggerid', 'description', 'priority'],
        preservekeys: 1,
        filter: { 'priority': severities },
        search: {
          'description': annotation.trigger
        },
        searchWildcardsEnabled: true,
        expandDescription: true
      };
      if (annotation.host) {
        params.host = templateSrv.replace(annotation.host);
      }
      else if (annotation.group) {
        params.group = templateSrv.replace(annotation.group);
      }

      return this.zabbixAPI.performZabbixAPIRequest('trigger.get', params)
        .then(function (result) {
          if(result) {
            var objects = result;
            var params = {
              output: 'extend',
              time_from: from,
              time_till: to,
              objectids: _.keys(objects),
              select_acknowledges: 'extend',
              selectHosts: 'extend'
            };

            // Show problem events only
            if (!annotation.showOkEvents) {
              params.value = 1;
            }

            return self.zabbixAPI.performZabbixAPIRequest('event.get', params)
              .then(function (result) {
                var events = [];

                _.each(result, function(e) {
                  var title ='';
                  if (annotation.showHostname) {
                    title += e.hosts[0].name + ': ';
                  }
                  title += Number(e.value) ? 'Problem' : 'OK';

                  // Hide acknowledged events
                  if (e.acknowledges.length > 0 && annotation.showAcknowledged) { return; }

                  var formatted_acknowledges = zabbixHelperSrv.formatAcknowledges(e.acknowledges);
                  events.push({
                    annotation: annotation,
                    time: e.clock * 1000,
                    title: title,
                    text: objects[e.objectid].description + formatted_acknowledges
                  });
                });
                return events;
              });
          } else {
            return [];
          }
        });
    };

  }

  return ZabbixAPIDatasource;

});
