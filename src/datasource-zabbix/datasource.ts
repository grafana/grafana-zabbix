import _ from 'lodash';
import config from 'grafana/app/core/config';
import { contextSrv } from 'grafana/app/core/core';
import * as dateMath from 'grafana/app/core/utils/datemath';
import * as utils from './utils';
import * as migrations from './migrations';
import * as metricFunctions from './metricFunctions';
import * as c from './constants';
import dataProcessor from './dataProcessor';
import responseHandler from './responseHandler';
import problemsHandler from './problemsHandler';
import { Zabbix } from './zabbix/zabbix';
import { ZabbixAPIError } from './zabbix/connectors/zabbix_api/zabbixAPICore';
import { VariableQueryTypes, ShowProblemTypes } from './types';

export class ZabbixDatasource {
  name: string;
  url: string;
  basicAuth: any;
  withCredentials: any;

  username: string;
  password: string;
  trends: boolean;
  trendsFrom: string;
  trendsRange: string;
  cacheTTL: any;
  alertingEnabled: boolean;
  addThresholds: boolean;
  alertingMinSeverity: string;
  disableReadOnlyUsersAck: boolean;
  enableDirectDBConnection: boolean;
  dbConnectionDatasourceId: number;
  dbConnectionDatasourceName: string;
  dbConnectionRetentionPolicy: string;
  enableDebugLog: boolean;
  zabbix: any;

  replaceTemplateVars: (target: any, scopedVars?: any) => any;

  /** @ngInject */
  constructor(instanceSettings, private templateSrv, private zabbixAlertingSrv) {
    this.templateSrv = templateSrv;
    this.zabbixAlertingSrv = zabbixAlertingSrv;

    this.enableDebugLog = config.buildInfo.env === 'development';

    // Use custom format for template variables
    this.replaceTemplateVars = _.partial(replaceTemplateVars, this.templateSrv);

    // General data source settings
    this.name             = instanceSettings.name;
    this.url              = instanceSettings.url;
    this.basicAuth        = instanceSettings.basicAuth;
    this.withCredentials  = instanceSettings.withCredentials;

    const jsonData = migrations.migrateDSConfig(instanceSettings.jsonData);

    // Zabbix API credentials
    this.username         = jsonData.username;
    this.password         = jsonData.password;

    // Use trends instead history since specified time
    this.trends           = jsonData.trends;
    this.trendsFrom       = jsonData.trendsFrom || '7d';
    this.trendsRange      = jsonData.trendsRange || '4d';

    // Set cache update interval
    const ttl = jsonData.cacheTTL || '1h';
    this.cacheTTL = utils.parseInterval(ttl);

    // Alerting options
    this.alertingEnabled =     jsonData.alerting;
    this.addThresholds =       jsonData.addThresholds;
    this.alertingMinSeverity = jsonData.alertingMinSeverity || c.SEV_WARNING;

    // Other options
    this.disableReadOnlyUsersAck = jsonData.disableReadOnlyUsersAck;

    // Direct DB Connection options
    this.enableDirectDBConnection = jsonData.dbConnectionEnable || false;
    this.dbConnectionDatasourceId = jsonData.dbConnectionDatasourceId;
    this.dbConnectionDatasourceName = jsonData.dbConnectionDatasourceName;
    this.dbConnectionRetentionPolicy = jsonData.dbConnectionRetentionPolicy;

    const zabbixOptions = {
      url: this.url,
      username: this.username,
      password: this.password,
      basicAuth: this.basicAuth,
      withCredentials: this.withCredentials,
      cacheTTL: this.cacheTTL,
      enableDirectDBConnection: this.enableDirectDBConnection,
      dbConnectionDatasourceId: this.dbConnectionDatasourceId,
      dbConnectionDatasourceName: this.dbConnectionDatasourceName,
      dbConnectionRetentionPolicy: this.dbConnectionRetentionPolicy,
    };

    this.zabbix = new Zabbix(zabbixOptions);
  }

  ////////////////////////
  // Datasource methods //
  ////////////////////////

  /**
   * Query panel data. Calls for each panel in dashboard.
   * @param  {Object} options   Contains time range, targets and other info.
   * @return {Object} Grafana metrics object with timeseries data for each target.
   */
  query(options) {
    // Get alerts for current panel
    if (this.alertingEnabled) {
      this.alertQuery(options).then(alert => {
        this.zabbixAlertingSrv.setPanelAlertState(options.panelId, alert.state);

        this.zabbixAlertingSrv.removeZabbixThreshold(options.panelId);
        if (this.addThresholds) {
          _.forEach(alert.thresholds, threshold => {
            this.zabbixAlertingSrv.setPanelThreshold(options.panelId, threshold);
          });
        }
      });
    }

    // Create request for each target
    const promises = _.map(options.targets, t => {
      // Don't request for hidden targets
      if (t.hide) {
        return [];
      }

      let timeFrom = Math.ceil(dateMath.parse(options.range.from) / 1000);
      let timeTo = Math.ceil(dateMath.parse(options.range.to) / 1000);

      // Add range variables
      options.scopedVars = Object.assign({}, options.scopedVars, utils.getRangeScopedVars(options.range));

      // Prevent changes of original object
      let target = _.cloneDeep(t);

      // Migrate old targets
      target = migrations.migrate(target);
      this.replaceTargetVariables(target, options);

      // Apply Time-related functions (timeShift(), etc)
      const timeFunctions = bindFunctionDefs(target.functions, 'Time');
      if (timeFunctions.length) {
        const [time_from, time_to] = utils.sequence(timeFunctions)([timeFrom, timeTo]);
        timeFrom = time_from;
        timeTo = time_to;
      }
      const timeRange = [timeFrom, timeTo];

      const useTrends = this.isUseTrends(timeRange);

      // Metrics or Text query
      if (!target.queryType || target.queryType === c.MODE_METRICS || target.queryType === c.MODE_TEXT) {
        // Don't request undefined targets
        if (!target.group || !target.host || !target.item) {
          return [];
        }

        if (!target.queryType || target.queryType === c.MODE_METRICS) {
          return this.queryNumericData(target, timeRange, useTrends, options);
        } else if (target.queryType === c.MODE_TEXT) {
          return this.queryTextData(target, timeRange);
        }
      } else if (target.queryType === c.MODE_ITEMID) {
        // Item ID query
        if (!target.itemids) {
          return [];
        }
        return this.queryItemIdData(target, timeRange, useTrends, options);
      } else if (target.queryType === c.MODE_ITSERVICE) {
        // IT services query
        return this.queryITServiceData(target, timeRange, options);
      } else if (target.queryType === c.MODE_TRIGGERS) {
        // Triggers query
        return this.queryTriggersData(target, timeRange);
      } else if (target.queryType === c.MODE_PROBLEMS) {
        // Problems query
        return this.queryProblems(target, timeRange, options);
      } else {
        return [];
      }
    });

    // Data for panel (all targets)
    return Promise.all(_.flatten(promises))
      .then(_.flatten)
      .then(data => {
        return { data: data };
      });
  }

  /**
   * Query target data for Metrics
   */
  queryNumericData(target, timeRange, useTrends, options) {
    let queryStart, queryEnd;
    const getItemOptions = {
      itemtype: 'num'
    };
    return this.zabbix.getItemsFromTarget(target, getItemOptions)
    .then(items => {
      queryStart = new Date().getTime();
      return this.queryNumericDataForItems(items, target, timeRange, useTrends, options);
    }).then(result => {
      queryEnd = new Date().getTime();
      if (this.enableDebugLog) {
        console.log(`Datasource::Performance Query Time (${this.name}): ${queryEnd - queryStart}`);
      }
      return result;
    });
  }

  /**
   * Query history for numeric items
   */
  queryNumericDataForItems(items, target, timeRange, useTrends, options) {
    let getHistoryPromise;
    options.valueType = this.getTrendValueType(target);
    options.consolidateBy = getConsolidateBy(target) || options.valueType;

    if (useTrends) {
      getHistoryPromise = this.zabbix.getTrends(items, timeRange, options);
    } else {
      getHistoryPromise = this.zabbix.getHistoryTS(items, timeRange, options);
    }

    return getHistoryPromise
    .then(timeseries => this.applyDataProcessingFunctions(timeseries, target))
    .then(timeseries => downsampleSeries(timeseries, options));
  }

  getTrendValueType(target) {
    // Find trendValue() function and get specified trend value
    const trendFunctions = _.map(metricFunctions.getCategories()['Trends'], 'name');
    const trendValueFunc = _.find(target.functions, func => {
      return _.includes(trendFunctions, func.def.name);
    });
    return trendValueFunc ? trendValueFunc.params[0] : "avg";
  }

  applyDataProcessingFunctions(timeseries_data, target) {
    const transformFunctions   = bindFunctionDefs(target.functions, 'Transform');
    const aggregationFunctions = bindFunctionDefs(target.functions, 'Aggregate');
    const filterFunctions      = bindFunctionDefs(target.functions, 'Filter');
    const aliasFunctions       = bindFunctionDefs(target.functions, 'Alias');

    // Apply transformation functions
    timeseries_data = _.cloneDeep(_.map(timeseries_data, timeseries => {
      timeseries.datapoints = utils.sequence(transformFunctions)(timeseries.datapoints);
      return timeseries;
    }));

    // Apply filter functions
    if (filterFunctions.length) {
      timeseries_data = utils.sequence(filterFunctions)(timeseries_data);
    }

    // Apply aggregations
    if (aggregationFunctions.length) {
      let dp = _.map(timeseries_data, 'datapoints');
      dp = utils.sequence(aggregationFunctions)(dp);

      const aggFuncNames = _.map(metricFunctions.getCategories()['Aggregate'], 'name');
      const lastAgg = _.findLast(target.functions, func => {
        return _.includes(aggFuncNames, func.def.name);
      });

      timeseries_data = [{
        target: lastAgg.text,
        datapoints: dp
      }];
    }

    // Apply alias functions
    _.forEach(timeseries_data, utils.sequence(aliasFunctions).bind(this));

    // Apply Time-related functions (timeShift(), etc)
    // Find timeShift() function and get specified trend value
    this.applyTimeShiftFunction(timeseries_data, target);

    return timeseries_data;
  }

  applyTimeShiftFunction(timeseries_data, target) {
    // Find timeShift() function and get specified interval
    const timeShiftFunc = _.find(target.functions, (func) => {
      return func.def.name === 'timeShift';
    });
    if (timeShiftFunc) {
      const shift = timeShiftFunc.params[0];
      _.forEach(timeseries_data, (series) => {
        series.datapoints = dataProcessor.unShiftTimeSeries(shift, series.datapoints);
      });
    }
  }

  /**
   * Query target data for Text
   */
  queryTextData(target, timeRange) {
    const options = {
      itemtype: 'text'
    };
    return this.zabbix.getItemsFromTarget(target, options)
    .then(items => {
      return this.zabbix.getHistoryText(items, timeRange, target);
    });
  }

  /**
   * Query target data for Item ID
   */
  queryItemIdData(target, timeRange, useTrends, options) {
    let itemids = target.itemids;
    itemids = this.templateSrv.replace(itemids, options.scopedVars, zabbixItemIdsTemplateFormat);
    itemids = _.map(itemids.split(','), itemid => itemid.trim());

    if (!itemids) {
      return [];
    }

    return this.zabbix.getItemsByIDs(itemids)
    .then(items => {
      return this.queryNumericDataForItems(items, target, timeRange, useTrends, options);
    });
  }

  /**
   * Query target data for IT Services
   */
  queryITServiceData(target, timeRange, options) {
    // Don't show undefined and hidden targets
    if (target.hide || (!target.itservice && !target.itServiceFilter) || !target.slaProperty) {
      return [];
    }

    let itServiceFilter;
    options.isOldVersion = target.itservice && !target.itServiceFilter;

    if (options.isOldVersion) {
      // Backward compatibility
      itServiceFilter = '/.*/';
    } else {
      itServiceFilter = this.replaceTemplateVars(target.itServiceFilter, options.scopedVars);
    }

    return this.zabbix.getITServices(itServiceFilter)
    .then(itservices => {
      return this.zabbix.getSLA(itservices, timeRange, target, options);})
    .then(itservicesdp => this.applyDataProcessingFunctions(itservicesdp, target));
  }

  queryTriggersData(target, timeRange) {
    const [timeFrom, timeTo] = timeRange;
    return this.zabbix.getHostsFromTarget(target)
    .then(results => {
      const [hosts, apps] = results;
      if (hosts.length) {
        const hostids = _.map(hosts, 'hostid');
        const appids = _.map(apps, 'applicationid');
        const options = {
          minSeverity: target.triggers.minSeverity,
          acknowledged: target.triggers.acknowledged,
          count: target.triggers.count,
          timeFrom: timeFrom,
          timeTo: timeTo
        };
        const groupFilter = target.group.filter;
        return Promise.all([
          this.zabbix.getHostAlerts(hostids, appids, options),
          this.zabbix.getGroups(groupFilter)
        ])
        .then(([triggers, groups]) => {
          return responseHandler.handleTriggersResponse(triggers, groups, timeRange);
        });
      } else {
        return Promise.resolve([]);
      }
    });
  }

  queryProblems(target, timeRange, options) {
    const [timeFrom, timeTo] = timeRange;
    const userIsEditor = contextSrv.isEditor || contextSrv.isGrafanaAdmin;

    let proxies;
    let showAckButton = true;

    const showProblems = target.showProblems || ShowProblemTypes.Problems;
    const showProxy = target.options.hostProxy;

    const getProxiesPromise = showProxy ? this.zabbix.getProxies() : () => [];
    showAckButton = !this.disableReadOnlyUsersAck || userIsEditor;

    // Replace template variables
    const groupFilter = this.replaceTemplateVars(target.group?.filter, options.scopedVars);
    const hostFilter = this.replaceTemplateVars(target.host?.filter, options.scopedVars);
    const appFilter = this.replaceTemplateVars(target.application?.filter, options.scopedVars);
    const proxyFilter = this.replaceTemplateVars(target.proxy?.filter, options.scopedVars);

    const triggerFilter = this.replaceTemplateVars(target.trigger?.filter, options.scopedVars);
    const tagsFilter = this.replaceTemplateVars(target.tags?.filter, options.scopedVars);

    const replacedTarget = {
      ...target,
      trigger: { filter: triggerFilter },
      tags: { filter: tagsFilter },
    };

    const triggersOptions: any = {
      showTriggers: showProblems
    };

    if (showProblems !== ShowProblemTypes.Problems) {
      triggersOptions.timeFrom = timeFrom;
      triggersOptions.timeTo = timeTo;
    }

    const problemsPromises = Promise.all([
      this.zabbix.getTriggers(groupFilter, hostFilter, appFilter, triggersOptions, proxyFilter),
      getProxiesPromise
    ])
    .then(([triggers, sourceProxies]) => {
      proxies = _.keyBy(sourceProxies, 'proxyid');
      const eventids = _.compact(triggers.map(trigger => {
        return trigger.lastEvent.eventid;
      }));
      return Promise.all([
        this.zabbix.getExtendedEventData(eventids),
        Promise.resolve(triggers)
      ]);
    })
    .then(([events, triggers]) => {
      problemsHandler.addEventTags(events, triggers);
      problemsHandler.addAcknowledges(events, triggers);
      return triggers;
    })
    .then(triggers => problemsHandler.setMaintenanceStatus(triggers))
    .then(triggers => problemsHandler.setAckButtonStatus(triggers, showAckButton))
    .then(triggers => problemsHandler.filterTriggersPre(triggers, replacedTarget))
    .then(triggers => problemsHandler.addTriggerDataSource(triggers, target))
    .then(triggers => problemsHandler.addTriggerHostProxy(triggers, proxies));

    return problemsPromises.then(problems => {
      const problemsDataFrame = problemsHandler.toDataFrame(problems);
      return problemsDataFrame;
    });
  }

  /**
   * Test connection to Zabbix API and external history DB.
   */
  testDatasource() {
    return this.zabbix.testDataSource()
    .then(result => {
      const { zabbixVersion, dbConnectorStatus } = result;
      let message = `Zabbix API version: ${zabbixVersion}`;
      if (dbConnectorStatus) {
        message += `, DB connector type: ${dbConnectorStatus.dsType}`;
      }
      return {
        status: "success",
        title: "Success",
        message: message
      };
    })
    .catch(error => {
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
      } else if (typeof(error) === 'string') {
        return {
          status: "error",
          title: "Connection failed",
          message: "Connection failed: " + error
        };
      } else {
        console.log(error);
        return {
          status: "error",
          title: "Connection failed",
          message: "Could not connect to given url"
        };
      }
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
    let resultPromise;
    let queryModel = _.cloneDeep(query);

    if (!query) {
      return Promise.resolve([]);
    }

    if (typeof query === 'string') {
      // Backward compatibility
      queryModel = utils.parseLegacyVariableQuery(query);
    }

    for (const prop of ['group', 'host', 'application', 'item']) {
      queryModel[prop] = this.replaceTemplateVars(queryModel[prop], {});
    }

    switch (queryModel.queryType) {
      case VariableQueryTypes.Group:
        resultPromise = this.zabbix.getGroups(queryModel.group);
        break;
      case VariableQueryTypes.Host:
        resultPromise = this.zabbix.getHosts(queryModel.group, queryModel.host);
        break;
      case VariableQueryTypes.Application:
        resultPromise = this.zabbix.getApps(queryModel.group, queryModel.host, queryModel.application);
        break;
      case VariableQueryTypes.Item:
        resultPromise = this.zabbix.getItems(queryModel.group, queryModel.host, queryModel.application, queryModel.item);
        break;
      default:
        resultPromise = Promise.resolve([]);
        break;
    }

    return resultPromise.then(metrics => {
      return _.map(metrics, formatMetric);
    });
  }

  /////////////////
  // Annotations //
  /////////////////

  annotationQuery(options) {
    const timeRange = options.range || options.rangeRaw;
    const timeFrom = Math.ceil(dateMath.parse(timeRange.from) / 1000);
    const timeTo = Math.ceil(dateMath.parse(timeRange.to) / 1000);
    const annotation = options.annotation;
    const showOkEvents = annotation.showOkEvents ? c.SHOW_ALL_EVENTS : c.SHOW_OK_EVENTS;

    // Show all triggers
    const triggersOptions = {
      showTriggers: c.SHOW_ALL_TRIGGERS,
      hideHostsInMaintenance: false
    };

    const getTriggers = this.zabbix.getTriggers(this.replaceTemplateVars(annotation.group, {}),
                                              this.replaceTemplateVars(annotation.host, {}),
                                              this.replaceTemplateVars(annotation.application, {}),
                                              triggersOptions);

    return getTriggers.then(triggers => {

      // Filter triggers by description
      const triggerName = this.replaceTemplateVars(annotation.trigger, {});
      if (utils.isRegex(triggerName)) {
        triggers = _.filter(triggers, trigger => {
          return utils.buildRegex(triggerName).test(trigger.description);
        });
      } else if (triggerName) {
        triggers = _.filter(triggers, trigger => {
          return trigger.description === triggerName;
        });
      }

      // Remove events below the chose severity
      triggers = _.filter(triggers, trigger => {
        return Number(trigger.priority) >= Number(annotation.minseverity);
      });

      const objectids = _.map(triggers, 'triggerid');
      return this.zabbix
        .getEvents(objectids, timeFrom, timeTo, showOkEvents)
        .then(events => {
          const indexedTriggers = _.keyBy(triggers, 'triggerid');

          // Hide acknowledged events if option enabled
          if (annotation.hideAcknowledged) {
            events = _.filter(events, event => {
              return !event.acknowledges.length;
            });
          }

          return _.map(events, event => {
            let tags;
            if (annotation.showHostname) {
              tags = _.map(event.hosts, 'name');
            }

            // Show event type (OK or Problem)
            const title = Number(event.value) ? 'Problem' : 'OK';

            const formattedAcknowledges = utils.formatAcknowledges(event.acknowledges);
            const eventName = event.name || indexedTriggers[event.objectid].description;
            return {
              annotation: annotation,
              time: event.clock * 1000,
              title: title,
              tags: tags,
              text: eventName + formattedAcknowledges
            };
          });
        });
    });
  }

  /**
   * Get triggers and its details for panel's targets
   * Returns alert state ('ok' if no fired triggers, or 'alerting' if at least 1 trigger is fired)
   * or empty object if no related triggers are finded.
   */
  alertQuery(options) {
    const enabled_targets = filterEnabledTargets(options.targets);
    const getPanelItems = _.map(enabled_targets, t => {
      let target = _.cloneDeep(t);
      target = migrations.migrate(target);
      this.replaceTargetVariables(target, options);
      return this.zabbix.getItemsFromTarget(target, {itemtype: 'num'});
    });

    return Promise.all(getPanelItems)
    .then(results => {
      const items = _.flatten(results);
      const itemids = _.map(items, 'itemid');

      if (itemids.length === 0) {
        return [];
      }
      return this.zabbix.getAlerts(itemids);
    })
    .then(triggers => {
      triggers = _.filter(triggers, trigger => {
        return trigger.priority >= this.alertingMinSeverity;
      });

      if (!triggers || triggers.length === 0) {
        return {};
      }

      let state = 'ok';

      const firedTriggers = _.filter(triggers, {value: '1'});
      if (firedTriggers.length) {
        state = 'alerting';
      }

      const thresholds = _.map(triggers, trigger => {
        return getTriggerThreshold(trigger.expression);
      });

      return {
        panelId: options.panelId,
        state: state,
        thresholds: thresholds
      };
    });
  }

  // Replace template variables
  replaceTargetVariables(target, options) {
    const parts = ['group', 'host', 'application', 'item'];
    _.forEach(parts, p => {
      if (target[p] && target[p].filter) {
        target[p].filter = this.replaceTemplateVars(target[p].filter, options.scopedVars);
      }
    });
    target.textFilter = this.replaceTemplateVars(target.textFilter, options.scopedVars);

    _.forEach(target.functions, func => {
      func.params = _.map(func.params, param => {
        if (typeof param === 'number') {
          return +this.templateSrv.replace(param.toString(), options.scopedVars);
        } else {
          return this.templateSrv.replace(param, options.scopedVars);
        }
      });
    });
  }

  isUseTrends(timeRange) {
    const [timeFrom, timeTo] = timeRange;
    const useTrendsFrom = Math.ceil(dateMath.parse('now-' + this.trendsFrom) / 1000);
    const useTrendsRange = Math.ceil(utils.parseInterval(this.trendsRange) / 1000);
    const useTrends = this.trends && (
      (timeFrom < useTrendsFrom) ||
      (timeTo - timeFrom > useTrendsRange)
    );
    return useTrends;
  }
}

function bindFunctionDefs(functionDefs, category) {
  const aggregationFunctions = _.map(metricFunctions.getCategories()[category], 'name');
  const aggFuncDefs = _.filter(functionDefs, func => {
    return _.includes(aggregationFunctions, func.def.name);
  });

  return _.map(aggFuncDefs, func => {
    const funcInstance = metricFunctions.createFuncInstance(func.def, func.params);
    return funcInstance.bindFunction(dataProcessor.metricFunctions);
  });
}

function getConsolidateBy(target) {
  let consolidateBy;
  const funcDef = _.find(target.functions, func => {
    return func.def.name === 'consolidateBy';
  });
  if (funcDef && funcDef.params && funcDef.params.length) {
    consolidateBy = funcDef.params[0];
  }
  return consolidateBy;
}

function downsampleSeries(timeseries_data, options) {
  const defaultAgg = dataProcessor.aggregationFunctions['avg'];
  const consolidateByFunc = dataProcessor.aggregationFunctions[options.consolidateBy] || defaultAgg;
  return _.map(timeseries_data, timeseries => {
    if (timeseries.datapoints.length > options.maxDataPoints) {
      timeseries.datapoints = dataProcessor
        .groupBy(options.interval, consolidateByFunc, timeseries.datapoints);
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
export function zabbixTemplateFormat(value) {
  if (typeof value === 'string') {
    return utils.escapeRegex(value);
  }

  const escapedValues = _.map(value, utils.escapeRegex);
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
  let replacedTarget = templateSrv.replace(target, scopedVars, zabbixTemplateFormat);
  if (target !== replacedTarget && !utils.isRegex(replacedTarget)) {
    replacedTarget = '/^' + replacedTarget + '$/';
  }
  return replacedTarget;
}

function filterEnabledTargets(targets) {
  return _.filter(targets, target => {
    return !(target.hide || !target.group || !target.host || !target.item);
  });
}

function getTriggerThreshold(expression) {
  const thresholdPattern = /.*[<>=]{1,2}([\d\.]+)/;
  const finded_thresholds = expression.match(thresholdPattern);
  if (finded_thresholds && finded_thresholds.length >= 2) {
    let threshold = finded_thresholds[1];
    threshold = Number(threshold);
    return threshold;
  } else {
    return null;
  }
}
