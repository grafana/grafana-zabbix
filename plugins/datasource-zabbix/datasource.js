define([
  'angular',
  'lodash',
  'app/core/utils/datemath',
  './directives',
  './zabbixAPIWrapper',
  './utils',
  './helperFunctions',
  './zabbixCacheSrv',
  './queryCtrl'
],
function (angular, _, dateMath) {
  'use strict';

  /** @ngInject */
  function ZabbixAPIDatasource(instanceSettings, $q, backendSrv, templateSrv, alertSrv,
                                ZabbixAPI, Utils, zabbixHelperSrv, ZabbixCache) {

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
    console.log(this.zabbixCache);

    /**
     * Test connection to Zabbix API
     *
     * @return {object} Connection status and Zabbix API version
     */
    this.testDatasource = function() {
      var self = this;
      return this.zabbixAPI.getZabbixAPIVersion().then(function (apiVersion) {
        return self.zabbixAPI.performZabbixAPILogin().then(function (auth) {
          if (auth) {
            return {
              status: "success",
              title: "Success",
              message: "Zabbix API version: " + apiVersion
            };
          } else {
            return {
              status: "error",
              title: "Invalid user name or password",
              message: "Zabbix API version: " + apiVersion
            };
          }
        });
      }, function(error) {
        return {
          status: "error",
          title: "Connection failed",
          message: "Could not connect to " + error.config.url
        };
      });
    };

    /**
     * Calls for each panel in dashboard.
     *
     * @param  {Object} options   Query options. Contains time range, targets
     *                            and other info.
     *
     * @return {Object}           Grafana metrics object with timeseries data
     *                            for each target.
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
          if (!target.mode) {

            // Find items by item names and perform queries
            var groups = [];
            var hosts = [];
            var apps = [];
            var items = [];

            if (target.host.isRegex) {

              // Filter groups
              if (target.group.isRegex) {
                var groupPattern = Utils.buildRegex(groupFilter);
                groups = _.filter(self.zabbixCache.getGroups(), function (groupObj) {
                  return groupPattern.test(groupObj.name);
                });
              } else {
                var findedGroup = _.find(self.zabbixCache.getGroups(), {'name': groupFilter});
                if (findedGroup) {
                  groups.push(findedGroup);
                } else {
                  groups = undefined;
                }
              }
              if (groups) {
                var groupids = _.map(groups, 'groupid');
                hosts = _.filter(self.zabbixCache.getHosts(), function (hostObj) {
                  return _.intersection(groupids, hostObj.groups).length;
                });
              } else {
                // No groups finded
                return [];
              }

              // Filter hosts
              var hostPattern = Utils.buildRegex(hostFilter);
              hosts = _.filter(hosts, function (hostObj) {
                return hostPattern.test(hostObj.name);
              });
            } else {
              var findedHost = _.find(self.zabbixCache.getHosts(), {'name': hostFilter});
              if (findedHost) {
                hosts.push(findedHost);
              } else {
                // No hosts finded
                return [];
              }
            }

            // Find items belongs to selected hosts
            items = _.filter(self.zabbixCache.getItems(), function (itemObj) {
              return _.contains(_.map(hosts, 'hostid'), itemObj.hostid);
            });

            if (target.item.isRegex) {

              // Filter applications
              if (target.application.isRegex) {
                var appPattern = Utils.buildRegex(appFilter);
                apps = _.filter(self.zabbixCache.getApplications(), function (appObj) {
                  return appPattern.test(appObj.name);
                });
              }
              // Don't use application filter if it empty
              else if (appFilter === "") {
                apps = undefined;
              }
              else {
                var findedApp = _.find(self.zabbixCache.getApplications(), {'name': appFilter});
                if (findedApp) {
                  apps.push(findedApp);
                } else {
                  // No applications finded
                  return [];
                }
              }

              // Find items belongs to selected applications
              if (apps) {
                var appids = _.flatten(_.map(apps, 'applicationids'));
                items = _.filter(items, function (itemObj) {
                  return _.intersection(appids, itemObj.applications).length;
                });
              }

              if (items) {
                var itemPattern = Utils.buildRegex(itemFilter);
                items = _.filter(items, function (itemObj) {
                  return itemPattern.test(itemObj.name);
                });
              } else {
                // No items finded
                return [];
              }
            } else {
              items = _.filter(items, {'name': hostFilter});
              if (!items.length) {
                // No items finded
                return [];
              }
            }

            // Set host as host name for each item
            items = _.each(items, function (itemObj) {
              itemObj.host = _.find(hosts, {'hostid': itemObj.hostid}).name;
            });

            // Use alias only for single metric, otherwise use item names
            var alias;
            if (items.length === 1) {
              alias = templateSrv.replace(target.alias, options.scopedVars);
            }

            var history;
            if ((from < useTrendsFrom) && self.trends) {
              // Use trends
              var points = target.downsampleFunction ? target.downsampleFunction.value : "avg";
              history = self.zabbixAPI.getTrends(items, from, to)
                .then(_.bind(zabbixHelperSrv.handleTrendResponse, zabbixHelperSrv, items, alias, target.scale, points));
            } else {
              // Use history
              history = self.zabbixAPI.getHistory(items, from, to)
                .then(_.bind(zabbixHelperSrv.handleHistoryResponse, zabbixHelperSrv, items, alias, target.scale));
            }

            return history.then(function (timeseries) {
              var timeseries_data = _.flatten(timeseries);
              return _.map(timeseries_data, function (timeseries) {

                // Series downsampling
                if (timeseries.datapoints.length > options.maxDataPoints) {
                  var ms_interval = Math.floor((to - from) / options.maxDataPoints) * 1000;
                  var downsampleFunc = target.downsampleFunction ? target.downsampleFunction.value : "avg";
                  timeseries.datapoints = zabbixHelperSrv.downsampleSeries(timeseries.datapoints, to, ms_interval, downsampleFunc);
                }
                return timeseries;
              });
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

      return $q.all(_.flatten(promises)).then(function (results) {
        var timeseries_data = _.flatten(results);
        return { data: timeseries_data };
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
