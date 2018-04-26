'use strict';

System.register(['lodash', 'app/core/utils/datemath', './utils', './migrations', './metricFunctions', './constants', './dataProcessor', './responseHandler', './zabbix.js', './zabbixAlerting.service.js', './zabbixAPICore.service.js'], function (_export, _context) {
  "use strict";

  var _, dateMath, utils, migrations, metricFunctions, c, dataProcessor, responseHandler, ZabbixAPIError, _slicedToArray, _createClass, ZabbixAPIDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function bindFunctionDefs(functionDefs, category) {
    var aggregationFunctions = _.map(metricFunctions.getCategories()[category], 'name');
    var aggFuncDefs = _.filter(functionDefs, function (func) {
      return _.includes(aggregationFunctions, func.def.name);
    });

    return _.map(aggFuncDefs, function (func) {
      var funcInstance = metricFunctions.createFuncInstance(func.def, func.params);
      return funcInstance.bindFunction(dataProcessor.metricFunctions);
    });
  }

  function getConsolidateBy(target) {
    var consolidateBy = 'avg';
    var funcDef = _.find(target.functions, function (func) {
      return func.def.name === 'consolidateBy';
    });
    if (funcDef && funcDef.params && funcDef.params.length) {
      consolidateBy = funcDef.params[0];
    }
    return consolidateBy;
  }

  function downsampleSeries(timeseries_data, options) {
    var defaultAgg = dataProcessor.aggregationFunctions['avg'];
    var consolidateByFunc = dataProcessor.aggregationFunctions[options.consolidateBy] || defaultAgg;
    return _.map(timeseries_data, function (timeseries) {
      if (timeseries.datapoints.length > options.maxDataPoints) {
        timeseries.datapoints = dataProcessor.groupBy(options.interval, consolidateByFunc, timeseries.datapoints);
      }
      return timeseries;
    });
  }

  function formatMetric(metricObj) {
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
  function zabbixTemplateFormat(value) {
    if (typeof value === 'string') {
      return utils.escapeRegex(value);
    }

    var escapedValues = _.map(value, utils.escapeRegex);
    return '(' + escapedValues.join('|') + ')';
  }

  function zabbixItemIdsTemplateFormat(value) {
    if (typeof value === 'string') {
      return value;
    }
    return value.join(',');
  }

  /**
   * If template variables are used in request, replace it using regex format
   * and wrap with '/' for proper multi-value work. Example:
   * $variable selected as a, b, c
   * We use filter $variable
   * $variable    -> a|b|c    -> /a|b|c/
   * /$variable/  -> /a|b|c/  -> /a|b|c/
   */
  function replaceTemplateVars(templateSrv, target, scopedVars) {
    var replacedTarget = templateSrv.replace(target, scopedVars, zabbixTemplateFormat);
    if (target !== replacedTarget && !utils.isRegex(replacedTarget)) {
      replacedTarget = '/^' + replacedTarget + '$/';
    }
    return replacedTarget;
  }

  // Apply function one by one:
  // sequence([a(), b(), c()]) = c(b(a()));
  function sequence(funcsArray) {
    return function (result) {
      for (var i = 0; i < funcsArray.length; i++) {
        result = funcsArray[i].call(this, result);
      }
      return result;
    };
  }

  function filterEnabledTargets(targets) {
    return _.filter(targets, function (target) {
      return !(target.hide || !target.group || !target.host || !target.item);
    });
  }

  function getTriggerThreshold(expression) {
    var thresholdPattern = /.*[<>=]{1,2}([\d\.]+)/;
    var finded_thresholds = expression.match(thresholdPattern);
    if (finded_thresholds && finded_thresholds.length >= 2) {
      var threshold = finded_thresholds[1];
      threshold = Number(threshold);
      return threshold;
    } else {
      return null;
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_appCoreUtilsDatemath) {
      dateMath = _appCoreUtilsDatemath;
    }, function (_utils) {
      utils = _utils;
    }, function (_migrations) {
      migrations = _migrations;
    }, function (_metricFunctions) {
      metricFunctions = _metricFunctions;
    }, function (_constants) {
      c = _constants;
    }, function (_dataProcessor) {
      dataProcessor = _dataProcessor.default;
    }, function (_responseHandler) {
      responseHandler = _responseHandler.default;
    }, function (_zabbixJs) {}, function (_zabbixAlertingServiceJs) {}, function (_zabbixAPICoreServiceJs) {
      ZabbixAPIError = _zabbixAPICoreServiceJs.ZabbixAPIError;
    }],
    execute: function () {
      _slicedToArray = function () {
        function sliceIterator(arr, i) {
          var _arr = [];
          var _n = true;
          var _d = false;
          var _e = undefined;

          try {
            for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
              _arr.push(_s.value);

              if (i && _arr.length === i) break;
            }
          } catch (err) {
            _d = true;
            _e = err;
          } finally {
            try {
              if (!_n && _i["return"]) _i["return"]();
            } finally {
              if (_d) throw _e;
            }
          }

          return _arr;
        }

        return function (arr, i) {
          if (Array.isArray(arr)) {
            return arr;
          } else if (Symbol.iterator in Object(arr)) {
            return sliceIterator(arr, i);
          } else {
            throw new TypeError("Invalid attempt to destructure non-iterable instance");
          }
        };
      }();

      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('ZabbixAPIDatasource', ZabbixAPIDatasource = function () {

        /** @ngInject */
        function ZabbixAPIDatasource(instanceSettings, templateSrv, alertSrv, dashboardSrv, zabbixAlertingSrv, Zabbix) {
          _classCallCheck(this, ZabbixAPIDatasource);

          this.templateSrv = templateSrv;
          this.alertSrv = alertSrv;
          this.dashboardSrv = dashboardSrv;
          this.zabbixAlertingSrv = zabbixAlertingSrv;

          // Use custom format for template variables
          this.replaceTemplateVars = _.partial(replaceTemplateVars, this.templateSrv);

          // General data source settings
          this.name = instanceSettings.name;
          this.url = instanceSettings.url;
          this.basicAuth = instanceSettings.basicAuth;
          this.withCredentials = instanceSettings.withCredentials;

          var jsonData = instanceSettings.jsonData || {};

          // Zabbix API credentials
          this.username = jsonData.username;
          this.password = jsonData.password;

          // Use trends instead history since specified time
          this.trends = jsonData.trends;
          this.trendsFrom = jsonData.trendsFrom || '7d';
          this.trendsRange = jsonData.trendsRange || '4d';

          // Set cache update interval
          var ttl = jsonData.cacheTTL || '1h';
          this.cacheTTL = utils.parseInterval(ttl);

          // Alerting options
          this.alertingEnabled = jsonData.alerting;
          this.addThresholds = jsonData.addThresholds;
          this.alertingMinSeverity = jsonData.alertingMinSeverity || c.SEV_WARNING;

          // Other options
          this.disableReadOnlyUsersAck = jsonData.disableReadOnlyUsersAck;

          // Direct DB Connection options
          var dbConnectionOptions = jsonData.dbConnection || {};
          this.enableDirectDBConnection = dbConnectionOptions.enable;
          this.sqlDatasourceId = dbConnectionOptions.datasourceId;

          var zabbixOptions = {
            username: this.username,
            password: this.password,
            basicAuth: this.basicAuth,
            withCredentials: this.withCredentials,
            cacheTTL: this.cacheTTL,
            enableDirectDBConnection: this.enableDirectDBConnection,
            sqlDatasourceId: this.sqlDatasourceId
          };

          this.zabbix = new Zabbix(this.url, zabbixOptions);
        }

        ////////////////////////
        // Datasource methods //
        ////////////////////////

        /**
         * Query panel data. Calls for each panel in dashboard.
         * @param  {Object} options   Contains time range, targets and other info.
         * @return {Object} Grafana metrics object with timeseries data for each target.
         */


        _createClass(ZabbixAPIDatasource, [{
          key: 'query',
          value: function query(options) {
            var _this = this;

            // Get alerts for current panel
            if (this.alertingEnabled) {
              this.alertQuery(options).then(function (alert) {
                _this.zabbixAlertingSrv.setPanelAlertState(options.panelId, alert.state);

                _this.zabbixAlertingSrv.removeZabbixThreshold(options.panelId);
                if (_this.addThresholds) {
                  _.forEach(alert.thresholds, function (threshold) {
                    _this.zabbixAlertingSrv.setPanelThreshold(options.panelId, threshold);
                  });
                }
              });
            }

            // Create request for each target
            var promises = _.map(options.targets, function (t) {
              // Don't request undefined and hidden targets
              if (t.hide) {
                return [];
              }

              var timeFrom = Math.ceil(dateMath.parse(options.range.from) / 1000);
              var timeTo = Math.ceil(dateMath.parse(options.range.to) / 1000);

              // Prevent changes of original object
              var target = _.cloneDeep(t);
              _this.replaceTargetVariables(target, options);

              // Apply Time-related functions (timeShift(), etc)
              var timeFunctions = bindFunctionDefs(target.functions, 'Time');
              if (timeFunctions.length) {
                var _sequence = sequence(timeFunctions)([timeFrom, timeTo]),
                    _sequence2 = _slicedToArray(_sequence, 2),
                    time_from = _sequence2[0],
                    time_to = _sequence2[1];

                timeFrom = time_from;
                timeTo = time_to;
              }
              var timeRange = [timeFrom, timeTo];

              var useTrends = _this.isUseTrends(timeRange);

              // Metrics or Text query mode
              if (!target.mode || target.mode === c.MODE_METRICS || target.mode === c.MODE_TEXT) {
                // Migrate old targets
                target = migrations.migrate(target);

                // Don't request undefined and hidden targets
                if (target.hide || !target.group || !target.host || !target.item) {
                  return [];
                }

                if (!target.mode || target.mode === c.MODE_METRICS) {
                  return _this.queryNumericData(target, timeRange, useTrends, options);
                } else if (target.mode === c.MODE_TEXT) {
                  return _this.queryTextData(target, timeRange);
                }
              } else if (target.mode === c.MODE_ITEMID) {
                // Item ID mode
                if (!target.itemids) {
                  return [];
                }
                return _this.queryItemIdData(target, timeRange, useTrends, options);
              } else if (target.mode === c.MODE_ITSERVICE) {
                // IT services mode
                return _this.queryITServiceData(target, timeRange, options);
              } else if (target.mode === c.MODE_TRIGGERS) {
                // Triggers mode
                return _this.queryTriggersData(target, timeRange);
              } else {
                return [];
              }
            });

            // Data for panel (all targets)
            return Promise.all(_.flatten(promises)).then(_.flatten).then(function (data) {
              return { data: data };
            });
          }
        }, {
          key: 'queryNumericData',
          value: function queryNumericData(target, timeRange, useTrends, options) {
            var _this2 = this;

            var getItemOptions = {
              itemtype: 'num'
            };
            return this.zabbix.getItemsFromTarget(target, getItemOptions).then(function (items) {
              return _this2.queryNumericDataForItems(items, target, timeRange, useTrends, options);
            });
          }
        }, {
          key: 'queryNumericDataForItems',
          value: function queryNumericDataForItems(items, target, timeRange, useTrends, options) {
            var _this3 = this;

            var _timeRange = _slicedToArray(timeRange, 2),
                timeFrom = _timeRange[0],
                timeTo = _timeRange[1];

            var getHistoryPromise = void 0;
            options.consolidateBy = getConsolidateBy(target);

            if (useTrends) {
              if (this.enableDirectDBConnection) {
                getHistoryPromise = this.zabbix.getTrendsDB(items, timeFrom, timeTo, options).then(function (history) {
                  return _this3.zabbix.dbConnector.handleGrafanaTSResponse(history, items);
                });
              } else {
                var valueType = this.getTrendValueType(target);
                getHistoryPromise = this.zabbix.getTrend(items, timeFrom, timeTo).then(function (history) {
                  return responseHandler.handleTrends(history, items, valueType);
                }).then(function (timeseries) {
                  // Sort trend data, issue #202
                  _.forEach(timeseries, function (series) {
                    series.datapoints = _.sortBy(series.datapoints, function (point) {
                      return point[c.DATAPOINT_TS];
                    });
                  });
                  return timeseries;
                });
              }
            } else {
              // Use history
              if (this.enableDirectDBConnection) {
                getHistoryPromise = this.zabbix.getHistoryDB(items, timeFrom, timeTo, options).then(function (history) {
                  return _this3.zabbix.dbConnector.handleGrafanaTSResponse(history, items);
                });
              } else {
                getHistoryPromise = this.zabbix.getHistory(items, timeFrom, timeTo).then(function (history) {
                  return responseHandler.handleHistory(history, items);
                });
              }
            }

            return getHistoryPromise.then(function (timeseries) {
              return _this3.applyDataProcessingFunctions(timeseries, target);
            }).then(function (timeseries) {
              return downsampleSeries(timeseries, options);
            });
          }
        }, {
          key: 'getTrendValueType',
          value: function getTrendValueType(target) {
            // Find trendValue() function and get specified trend value
            var trendFunctions = _.map(metricFunctions.getCategories()['Trends'], 'name');
            var trendValueFunc = _.find(target.functions, function (func) {
              return _.includes(trendFunctions, func.def.name);
            });
            return trendValueFunc ? trendValueFunc.params[0] : "avg";
          }
        }, {
          key: 'applyDataProcessingFunctions',
          value: function applyDataProcessingFunctions(timeseries_data, target) {
            var transformFunctions = bindFunctionDefs(target.functions, 'Transform');
            var aggregationFunctions = bindFunctionDefs(target.functions, 'Aggregate');
            var filterFunctions = bindFunctionDefs(target.functions, 'Filter');
            var aliasFunctions = bindFunctionDefs(target.functions, 'Alias');

            // Apply transformation functions
            timeseries_data = _.cloneDeep(_.map(timeseries_data, function (timeseries) {
              timeseries.datapoints = sequence(transformFunctions)(timeseries.datapoints);
              return timeseries;
            }));

            // Apply filter functions
            if (filterFunctions.length) {
              timeseries_data = sequence(filterFunctions)(timeseries_data);
            }

            // Apply aggregations
            if (aggregationFunctions.length) {
              var dp = _.map(timeseries_data, 'datapoints');
              dp = sequence(aggregationFunctions)(dp);

              var aggFuncNames = _.map(metricFunctions.getCategories()['Aggregate'], 'name');
              var lastAgg = _.findLast(target.functions, function (func) {
                return _.includes(aggFuncNames, func.def.name);
              });

              timeseries_data = [{
                target: lastAgg.text,
                datapoints: dp
              }];
            }

            // Apply alias functions
            _.forEach(timeseries_data, sequence(aliasFunctions));

            // Apply Time-related functions (timeShift(), etc)
            // Find timeShift() function and get specified trend value
            this.applyTimeShiftFunction(timeseries_data, target);

            return timeseries_data;
          }
        }, {
          key: 'applyTimeShiftFunction',
          value: function applyTimeShiftFunction(timeseries_data, target) {
            // Find timeShift() function and get specified interval
            var timeShiftFunc = _.find(target.functions, function (func) {
              return func.def.name === 'timeShift';
            });
            if (timeShiftFunc) {
              var shift = timeShiftFunc.params[0];
              _.forEach(timeseries_data, function (series) {
                series.datapoints = dataProcessor.unShiftTimeSeries(shift, series.datapoints);
              });
            }
          }
        }, {
          key: 'queryTextData',
          value: function queryTextData(target, timeRange) {
            var _this4 = this;

            var _timeRange2 = _slicedToArray(timeRange, 2),
                timeFrom = _timeRange2[0],
                timeTo = _timeRange2[1];

            var options = {
              itemtype: 'text'
            };
            return this.zabbix.getItemsFromTarget(target, options).then(function (items) {
              if (items.length) {
                return _this4.zabbix.getHistory(items, timeFrom, timeTo).then(function (history) {
                  if (target.resultFormat === 'table') {
                    return responseHandler.handleHistoryAsTable(history, items, target);
                  } else {
                    return responseHandler.handleText(history, items, target);
                  }
                });
              } else {
                return Promise.resolve([]);
              }
            });
          }
        }, {
          key: 'queryItemIdData',
          value: function queryItemIdData(target, timeRange, useTrends, options) {
            var _this5 = this;

            var itemids = target.itemids;
            itemids = this.templateSrv.replace(itemids, options.scopedVars, zabbixItemIdsTemplateFormat);
            itemids = _.map(itemids.split(','), function (itemid) {
              return itemid.trim();
            });

            if (!itemids) {
              return [];
            }

            return this.zabbix.getItemsByIDs(itemids).then(function (items) {
              return _this5.queryNumericDataForItems(items, target, timeRange, useTrends, options);
            });
          }
        }, {
          key: 'queryITServiceData',
          value: function queryITServiceData(target, timeRange, options) {
            var _this6 = this;

            // Don't show undefined and hidden targets
            if (target.hide || !target.itservice && !target.itServiceFilter || !target.slaProperty) {
              return [];
            }

            var itServiceIds = [];
            var itServices = [];
            var itServiceFilter = void 0;
            var isOldVersion = target.itservice && !target.itServiceFilter;

            if (isOldVersion) {
              // Backward compatibility
              itServiceFilter = '/.*/';
            } else {
              itServiceFilter = this.replaceTemplateVars(target.itServiceFilter, options.scopedVars);
            }

            return this.zabbix.getITServices(itServiceFilter).then(function (itservices) {
              itServices = itservices;
              if (isOldVersion) {
                itServices = _.filter(itServices, { 'serviceid': target.itservice.serviceid });
              }

              itServiceIds = _.map(itServices, 'serviceid');
              return itServiceIds;
            }).then(function (serviceids) {
              return _this6.zabbix.getSLA(serviceids, timeRange);
            }).then(function (slaResponse) {
              return _.map(itServiceIds, function (serviceid) {
                var itservice = _.find(itServices, { 'serviceid': serviceid });
                return responseHandler.handleSLAResponse(itservice, target.slaProperty, slaResponse);
              });
            });
          }
        }, {
          key: 'queryTriggersData',
          value: function queryTriggersData(target, timeRange) {
            var _this7 = this;

            var _timeRange3 = _slicedToArray(timeRange, 2),
                timeFrom = _timeRange3[0],
                timeTo = _timeRange3[1];

            return this.zabbix.getHostsFromTarget(target).then(function (results) {
              var _results = _slicedToArray(results, 2),
                  hosts = _results[0],
                  apps = _results[1];

              if (hosts.length) {
                var hostids = _.map(hosts, 'hostid');
                var appids = _.map(apps, 'applicationid');
                var options = {
                  minSeverity: target.triggers.minSeverity,
                  acknowledged: target.triggers.acknowledged,
                  count: target.triggers.count,
                  timeFrom: timeFrom,
                  timeTo: timeTo
                };
                return _this7.zabbix.getHostAlerts(hostids, appids, options).then(function (triggers) {
                  return responseHandler.handleTriggersResponse(triggers, timeRange);
                });
              } else {
                return Promise.resolve([]);
              }
            });
          }
        }, {
          key: 'testDatasource',
          value: function testDatasource() {
            var _this8 = this;

            var zabbixVersion = void 0;
            return this.zabbix.getVersion().then(function (version) {
              zabbixVersion = version;
              return _this8.zabbix.login();
            }).then(function () {
              if (_this8.enableDirectDBConnection) {
                return _this8.zabbix.dbConnector.testSQLDataSource();
              } else {
                return Promise.resolve();
              }
            }).then(function () {
              return {
                status: "success",
                title: "Success",
                message: "Zabbix API version: " + zabbixVersion
              };
            }).catch(function (error) {
              if (error instanceof ZabbixAPIError) {
                return {
                  status: "error",
                  title: error.message,
                  message: error.message
                };
              } else if (error.data && error.data.message) {
                return {
                  status: "error",
                  title: "Connection failed",
                  message: "Connection failed: " + error.data.message
                };
              } else {
                return {
                  status: "error",
                  title: "Connection failed",
                  message: "Could not connect to given url"
                };
              }
            });
          }
        }, {
          key: 'metricFindQuery',
          value: function metricFindQuery(query) {
            var _this9 = this;

            var result = void 0;
            var parts = [];

            // Split query. Query structure: group.host.app.item
            _.each(utils.splitTemplateQuery(query), function (part) {
              part = _this9.replaceTemplateVars(part, {});

              // Replace wildcard to regex
              if (part === '*') {
                part = '/.*/';
              }
              parts.push(part);
            });
            var template = _.zipObject(['group', 'host', 'app', 'item'], parts);

            // Get items
            if (parts.length === 4) {
              // Search for all items, even it's not belong to any application
              if (template.app === '/.*/') {
                template.app = '';
              }
              result = this.zabbix.getItems(template.group, template.host, template.app, template.item);
            } else if (parts.length === 3) {
              // Get applications
              result = this.zabbix.getApps(template.group, template.host, template.app);
            } else if (parts.length === 2) {
              // Get hosts
              result = this.zabbix.getHosts(template.group, template.host);
            } else if (parts.length === 1) {
              // Get groups
              result = this.zabbix.getGroups(template.group);
            } else {
              result = Promise.resolve([]);
            }

            return result.then(function (metrics) {
              return _.map(metrics, formatMetric);
            });
          }
        }, {
          key: 'annotationQuery',
          value: function annotationQuery(options) {
            var _this10 = this;

            var timeFrom = Math.ceil(dateMath.parse(options.rangeRaw.from) / 1000);
            var timeTo = Math.ceil(dateMath.parse(options.rangeRaw.to) / 1000);
            var annotation = options.annotation;
            var showOkEvents = annotation.showOkEvents ? c.SHOW_ALL_EVENTS : c.SHOW_OK_EVENTS;

            // Show all triggers
            var triggersOptions = {
              showTriggers: c.SHOW_ALL_TRIGGERS,
              hideHostsInMaintenance: false
            };

            var getTriggers = this.zabbix.getTriggers(this.replaceTemplateVars(annotation.group, {}), this.replaceTemplateVars(annotation.host, {}), this.replaceTemplateVars(annotation.application, {}), triggersOptions);

            return getTriggers.then(function (triggers) {

              // Filter triggers by description
              var triggerName = _this10.replaceTemplateVars(annotation.trigger, {});
              if (utils.isRegex(triggerName)) {
                triggers = _.filter(triggers, function (trigger) {
                  return utils.buildRegex(triggerName).test(trigger.description);
                });
              } else if (triggerName) {
                triggers = _.filter(triggers, function (trigger) {
                  return trigger.description === triggerName;
                });
              }

              // Remove events below the chose severity
              triggers = _.filter(triggers, function (trigger) {
                return Number(trigger.priority) >= Number(annotation.minseverity);
              });

              var objectids = _.map(triggers, 'triggerid');
              return _this10.zabbix.getEvents(objectids, timeFrom, timeTo, showOkEvents).then(function (events) {
                var indexedTriggers = _.keyBy(triggers, 'triggerid');

                // Hide acknowledged events if option enabled
                if (annotation.hideAcknowledged) {
                  events = _.filter(events, function (event) {
                    return !event.acknowledges.length;
                  });
                }

                return _.map(events, function (event) {
                  var tags = void 0;
                  if (annotation.showHostname) {
                    tags = _.map(event.hosts, 'name');
                  }

                  // Show event type (OK or Problem)
                  var title = Number(event.value) ? 'Problem' : 'OK';

                  var formatted_acknowledges = utils.formatAcknowledges(event.acknowledges);
                  return {
                    annotation: annotation,
                    time: event.clock * 1000,
                    title: title,
                    tags: tags,
                    text: indexedTriggers[event.objectid].description + formatted_acknowledges
                  };
                });
              });
            });
          }
        }, {
          key: 'alertQuery',
          value: function alertQuery(options) {
            var _this11 = this;

            var enabled_targets = filterEnabledTargets(options.targets);
            var getPanelItems = _.map(enabled_targets, function (t) {
              var target = _.cloneDeep(t);
              _this11.replaceTargetVariables(target, options);
              return _this11.zabbix.getItemsFromTarget(target, { itemtype: 'num' });
            });

            return Promise.all(getPanelItems).then(function (results) {
              var items = _.flatten(results);
              var itemids = _.map(items, 'itemid');

              if (itemids.length === 0) {
                return [];
              }
              return _this11.zabbix.getAlerts(itemids);
            }).then(function (triggers) {
              triggers = _.filter(triggers, function (trigger) {
                return trigger.priority >= _this11.alertingMinSeverity;
              });

              if (!triggers || triggers.length === 0) {
                return {};
              }

              var state = 'ok';

              var firedTriggers = _.filter(triggers, { value: '1' });
              if (firedTriggers.length) {
                state = 'alerting';
              }

              var thresholds = _.map(triggers, function (trigger) {
                return getTriggerThreshold(trigger.expression);
              });

              return {
                panelId: options.panelId,
                state: state,
                thresholds: thresholds
              };
            });
          }
        }, {
          key: 'replaceTargetVariables',
          value: function replaceTargetVariables(target, options) {
            var _this12 = this;

            var parts = ['group', 'host', 'application', 'item'];
            _.forEach(parts, function (p) {
              if (target[p] && target[p].filter) {
                target[p].filter = _this12.replaceTemplateVars(target[p].filter, options.scopedVars);
              }
            });
            target.textFilter = this.replaceTemplateVars(target.textFilter, options.scopedVars);

            _.forEach(target.functions, function (func) {
              func.params = _.map(func.params, function (param) {
                if (typeof param === 'number') {
                  return +_this12.templateSrv.replace(param.toString(), options.scopedVars);
                } else {
                  return _this12.templateSrv.replace(param, options.scopedVars);
                }
              });
            });
          }
        }, {
          key: 'isUseTrends',
          value: function isUseTrends(timeRange) {
            var _timeRange4 = _slicedToArray(timeRange, 2),
                timeFrom = _timeRange4[0],
                timeTo = _timeRange4[1];

            var useTrendsFrom = Math.ceil(dateMath.parse('now-' + this.trendsFrom) / 1000);
            var useTrendsRange = Math.ceil(utils.parseInterval(this.trendsRange) / 1000);
            var useTrends = this.trends && (timeFrom <= useTrendsFrom || timeTo - timeFrom >= useTrendsRange);
            return useTrends;
          }
        }]);

        return ZabbixAPIDatasource;
      }());

      _export('ZabbixAPIDatasource', ZabbixAPIDatasource);

      _export('zabbixTemplateFormat', zabbixTemplateFormat);

      // Fix for backward compatibility with lodash 2.4
      if (!_.includes) {
        _.includes = _.contains;
      }
      if (!_.keyBy) {
        _.keyBy = _.indexBy;
      }
    }
  };
});
//# sourceMappingURL=datasource.js.map
