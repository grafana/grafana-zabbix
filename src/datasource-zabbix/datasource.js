//import angular from 'angular';
import _ from 'lodash';
import * as dateMath from 'app/core/utils/datemath';
import * as utils from './utils';
import * as migrations from './migrations';
import * as metricFunctions from './metricFunctions';
import DataProcessor from './DataProcessor';
import './zabbixAPI.service.js';
import './zabbixCache.service.js';
import './queryProcessor.service.js';

export class ZabbixAPIDatasource {

  /** @ngInject */
  constructor(instanceSettings, $q, templateSrv, alertSrv, zabbixAPIService, ZabbixCachingProxy, QueryProcessor) {

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

    // Set cache update interval
    var ttl = instanceSettings.jsonData.cacheTTL || '1h';
    this.cacheTTL = utils.parseInterval(ttl);

    // Initialize Zabbix API
    var ZabbixAPI = zabbixAPIService;
    this.zabbixAPI = new ZabbixAPI(this.url, this.username, this.password, this.basicAuth, this.withCredentials);

    // Initialize cache service
    this.zabbixCache = new ZabbixCachingProxy(this.zabbixAPI, this.cacheTTL);

    // Initialize query builder
    this.queryProcessor = new QueryProcessor(this.zabbixCache);

    // Dependencies
    this.q = $q;
    this.templateSrv = templateSrv;
    this.alertSrv = alertSrv;

    // Use custom format for template variables
    this.replaceTemplateVars = _.partial(replaceTemplateVars, this.templateSrv);

    console.log(this.zabbixCache);
  }

  ////////////////////////
  // Datasource methods //
  ////////////////////////

  /**
   * Test connection to Zabbix API
   * @return {object} Connection status and Zabbix API version
   */
  testDatasource() {
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
  }

  /**
   * Query panel data. Calls for each panel in dashboard.
   * @param  {Object} options   Contains time range, targets and other info.
   * @return {Object} Grafana metrics object with timeseries data for each target.
   */
  query(options) {
    var self = this;

    // get from & to in seconds
    var from = Math.ceil(dateMath.parse(options.range.from) / 1000);
    var to = Math.ceil(dateMath.parse(options.range.to) / 1000);
    var useTrendsFrom = Math.ceil(dateMath.parse('now-' + this.trendsFrom) / 1000);

    // Create request for each target
    var promises = _.map(options.targets, function(target) {

      if (target.mode !== 1) {

        // Migrate old targets
        target = migrations.migrate(target);

        // Don't request undefined and hidden targets
        if (target.hide || !target.group ||
            !target.host || !target.item) {
          return [];
        }

        // Replace templated variables
        var groupFilter = this.replaceTemplateVars(target.group.filter, options.scopedVars);
        var hostFilter = this.replaceTemplateVars(target.host.filter, options.scopedVars);
        var appFilter = this.replaceTemplateVars(target.application.filter, options.scopedVars);
        var itemFilter = this.replaceTemplateVars(target.item.filter, options.scopedVars);

        // Query numeric data
        if (!target.mode || target.mode === 0) {

          // Build query in asynchronous manner
          return self.queryProcessor
            .build(groupFilter, hostFilter, appFilter, itemFilter, 'num')
            .then(items => {
              // Add hostname for items from multiple hosts
              var addHostName = utils.isRegex(target.host.filter);
              var getHistory;

              // Use trends
              if ((from < useTrendsFrom) && self.trends) {

                // Find trendValue() function and get specified trend value
                var trendFunctions = _.map(metricFunctions.getCategories()['Trends'], 'name');
                var trendValueFunc = _.find(target.functions, function(func) {
                  return _.contains(trendFunctions, func.def.name);
                });
                var valueType = trendValueFunc ? trendValueFunc.params[0] : "avg";

                getHistory = self.zabbixAPI.getTrend(items, from, to).then(function(history) {
                  return self.queryProcessor.handleTrends(history, items, addHostName, valueType);
                });
              } else {

                // Use history
                getHistory = self.zabbixCache.getHistory(items, from, to).then(function(history) {
                  return self.queryProcessor.handleHistory(history, items, addHostName);
                });
              }

              return getHistory.then(function (timeseries_data) {
                timeseries_data = _.map(timeseries_data, function (timeseries) {

                  // Filter only transform functions
                  var transformFunctions = bindFunctionDefs(target.functions, 'Transform', DataProcessor);

                  // Metric data processing
                  var dp = timeseries.datapoints;
                  for (var i = 0; i < transformFunctions.length; i++) {
                    dp = transformFunctions[i](dp);
                  }
                  timeseries.datapoints = dp;

                  return timeseries;
                });

                // Aggregations
                var aggregationFunctions = bindFunctionDefs(target.functions, 'Aggregate', DataProcessor);
                var dp = _.map(timeseries_data, 'datapoints');
                if (aggregationFunctions.length) {
                  for (var i = 0; i < aggregationFunctions.length; i++) {
                    dp = aggregationFunctions[i](dp);
                  }
                  var lastAgg = _.findLast(target.functions, function(func) {
                    return _.contains(
                      _.map(metricFunctions.getCategories()['Aggregate'], 'name'), func.def.name);
                  });
                  timeseries_data = [{
                    target: lastAgg.text,
                    datapoints: dp
                  }];
                }

                // Apply alias functions
                var aliasFunctions = bindFunctionDefs(target.functions, 'Alias', DataProcessor);
                for (var j = 0; j < aliasFunctions.length; j++) {
                  _.each(timeseries_data, aliasFunctions[j]);
                }

                return timeseries_data;
              });
            });
        }

        // Query text data
        else if (target.mode === 2) {
          return self.queryProcessor
            .build(groupFilter, hostFilter, appFilter, itemFilter, 'text')
            .then(items => {
              if (items.length) {
                var textItemsPromises = _.map(items, item => {
                  return self.zabbixAPI.getLastValue(item.itemid);
                });
                return self.q.all(textItemsPromises)
                  .then(result => {
                    return _.map(result, (lastvalue, index) => {
                      var extractedValue;
                      if (target.textFilter) {
                        var text_extract_pattern = new RegExp(self.replaceTemplateVars(target.textFilter, options.scopedVars));
                        extractedValue = text_extract_pattern.exec(lastvalue);
                        if (extractedValue) {
                          if (target.useCaptureGroups) {
                            extractedValue = extractedValue[1];
                          } else {
                            extractedValue = extractedValue[0];
                          }
                        }
                      } else {
                        extractedValue = lastvalue;
                      }
                      return {
                        target: items[index].name,
                        datapoints: [[extractedValue, to * 1000]]
                      };
                    });
                  });
              } else {
                return self.q.when([]);
              }
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
            .then(slaObject => {
              return self.queryProcessor.handleSLAResponse(target.itservice, target.slaProperty, slaObject);
            });
        }
      }
    }, this);

    // Data for panel (all targets)
    return this.q.all(_.flatten(promises))
      .then(_.flatten)
      .then(function (timeseries_data) {

        // Series downsampling
        var data = _.map(timeseries_data, function(timeseries) {
          if (timeseries.datapoints.length > options.maxDataPoints) {
            timeseries.datapoints =
              DataProcessor.groupBy(options.interval, DataProcessor.AVERAGE, timeseries.datapoints);
          }
          return timeseries;
        });
        return { data: data };
      });
  }

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
  metricFindQuery(query) {
    // Split query. Query structure:
    // group.host.app.item
    var self = this;
    var parts = [];
    _.each(query.split('.'), function (part) {
      part = self.replaceTemplateVars(part, {});

      // Replace wildcard to regex
      if (part === '*') {
        part = '/.*/';
      }
      parts.push(part);
    });
    var template = _.object(['group', 'host', 'app', 'item'], parts);

    // Get items
    if (parts.length === 4) {
      // Search for all items, even it's not belong to any application
      if (template.app === '/.*/') {
        template.app = '';
      }
      return this.queryProcessor.getItems(template.group, template.host, template.app)
        .then(function(items) {
          return _.map(items, formatMetric);
        });
    }
    // Get applications
    else if (parts.length === 3) {
      return this.queryProcessor.getApps(template.group, template.host)
        .then(function(apps) {
          return _.map(apps, formatMetric);
        });
    }
    // Get hosts
    else if (parts.length === 2) {
      return this.queryProcessor.getHosts(template.group)
        .then(function(hosts) {
          return _.map(hosts, formatMetric);
        });
    }
    // Get groups
    else if (parts.length === 1) {
      return this.zabbixCache.getGroups(template.group).then(function(groups) {
        return _.map(groups, formatMetric);
      });
    }
    // Return empty object for invalid request
    else {
      return this.q.when([]);
    }
  }

  /////////////////
  // Annotations //
  /////////////////

  annotationQuery(options) {
    var timeFrom = Math.ceil(dateMath.parse(options.rangeRaw.from) / 1000);
    var timeTo = Math.ceil(dateMath.parse(options.rangeRaw.to) / 1000);
    var annotation = options.annotation;
    var self = this;
    var showOkEvents = annotation.showOkEvents ? [0, 1] : 1;

    // Show all triggers
    var showTriggers = [0, 1];

    var buildQuery = self.queryProcessor.buildTriggerQuery(this.replaceTemplateVars(annotation.group, {}),
                                                           this.replaceTemplateVars(annotation.host, {}),
                                                           this.replaceTemplateVars(annotation.application, {}));
    return buildQuery.then(function(query) {
      return self.zabbixAPI.getTriggers(query.groupids,
                                        query.hostids,
                                        query.applicationids,
                                        showTriggers,
                                        timeFrom, timeTo)
        .then(function(triggers) {

          // Filter triggers by description
          if (utils.isRegex(annotation.trigger)) {
            triggers = _.filter(triggers, function(trigger) {
              return utils.buildRegex(annotation.trigger).test(trigger.description);
            });
          } else if (annotation.trigger) {
            triggers = _.filter(triggers, function(trigger) {
              return trigger.description === annotation.trigger;
            });
          }

          // Remove events below the chose severity
          triggers = _.filter(triggers, function(trigger) {
            return Number(trigger.priority) >= Number(annotation.minseverity);
          });

          var objectids = _.map(triggers, 'triggerid');
          return self.zabbixAPI.getEvents(objectids, timeFrom, timeTo, showOkEvents)
            .then(function (events) {
              var indexedTriggers = _.indexBy(triggers, 'triggerid');

              // Hide acknowledged events if option enabled
              if (annotation.hideAcknowledged) {
                events = _.filter(events, function(event) {
                  return !event.acknowledges.length;
                });
              }

              return _.map(events, function(e) {
                var title ='';
                if (annotation.showHostname) {
                  title += e.hosts[0].name + ': ';
                }

                // Show event type (OK or Problem)
                title += Number(e.value) ? 'Problem' : 'OK';

                var formatted_acknowledges = utils.formatAcknowledges(e.acknowledges);
                return {
                  annotation: annotation,
                  time: e.clock * 1000,
                  title: title,
                  text: indexedTriggers[e.objectid].description + formatted_acknowledges
                };
              });
            });
        });
    });
  }

}

function bindFunctionDefs(functionDefs, category, DataProcessor) {
  'use strict';
  var aggregationFunctions = _.map(metricFunctions.getCategories()[category], 'name');
  var aggFuncDefs = _.filter(functionDefs, function(func) {
    return _.contains(aggregationFunctions, func.def.name);
  });

  return _.map(aggFuncDefs, function(func) {
    var funcInstance = metricFunctions.createFuncInstance(func.def, func.params);
    return funcInstance.bindFunction(DataProcessor.metricFunctions);
  });
}

function formatMetric(metricObj) {
  'use strict';
  return {
    text: metricObj.name,
    expandable: false
  };
}

/**
 * Custom formatter for template variables.
 * Default Grafana "regex" formatter returns
 * value1|value2
 * This formatter returns
 * (value1|value2)
 * This format needed for using in complex regex with
 * template variables, for example
 * /CPU $cpu_item.*time/ where $cpu_item is system,user,iowait
 */
function zabbixTemplateFormat(value, variable) {
  if (typeof value === 'string') {
    return utils.escapeRegex(value);
  }

  var escapedValues = _.map(value, utils.escapeRegex);
  return '(' + escapedValues.join('|') + ')';
}

/** If template variables are used in request, replace it using regex format
 * and wrap with '/' for proper multi-value work. Example:
 * $variable selected as a, b, c
 * We use filter $variable
 * $variable    -> a|b|c    -> /a|b|c/
 * /$variable/  -> /a|b|c/  -> /a|b|c/
 */
function replaceTemplateVars(templateSrv, target, scopedVars) {
  var replacedTarget = templateSrv.replace(target, scopedVars, zabbixTemplateFormat);
  if (target !== replacedTarget && !utils.regexPattern.test(replacedTarget)) {
    replacedTarget = '/' + replacedTarget + '/';
  }
  return replacedTarget;
}
