import _ from 'lodash';
import config from 'grafana/app/core/config';
import { contextSrv } from 'grafana/app/core/core';
import * as dateMath from 'grafana/app/core/utils/datemath';
import * as utils from './utils';
import * as migrations from './migrations';
import * as metricFunctions from './metricFunctions';
import * as c from './constants';
import responseHandler from './responseHandler';
import problemsHandler from './problemsHandler';
import { Zabbix } from './zabbix/zabbix';
import { ZabbixAPIError } from './zabbix/connectors/zabbix_api/zabbixAPIConnector';
import { LegacyVariableQuery, ProblemDTO, VariableQuery, VariableQueryTypes } from './types';
import { ZabbixMetricsQuery, ShowProblemTypes } from './types/query';
import { ZabbixDSOptions } from './types/config';
import {
  BackendSrvRequest,
  getBackendSrv,
  getTemplateSrv,
  getDataSourceSrv,
  HealthCheckError,
  DataSourceWithBackend,
  TemplateSrv,
} from '@grafana/runtime';
import {
  DataFrame,
  dataFrameFromJSON,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  FieldType,
  isDataFrame,
  ScopedVars,
  toDataFrame,
} from '@grafana/data';
import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';
import { trackRequest } from './tracking';
import { from, lastValueFrom, map, Observable, switchMap } from 'rxjs';

export class ZabbixDatasource extends DataSourceWithBackend<ZabbixMetricsQuery, ZabbixDSOptions> {
  name: string;
  basicAuth: any;
  withCredentials: any;

  trends: boolean;
  trendsFrom: string;
  trendsRange: string;
  cacheTTL: any;
  disableReadOnlyUsersAck: boolean;
  disableDataAlignment: boolean;
  enableDirectDBConnection: boolean;
  dbConnectionDatasourceId: number;
  dbConnectionDatasourceName: string;
  dbConnectionRetentionPolicy: string;
  enableDebugLog: boolean;
  datasourceId: number;
  instanceSettings: DataSourceInstanceSettings<ZabbixDSOptions>;
  zabbix: Zabbix;

  constructor(
    instanceSettings: DataSourceInstanceSettings<ZabbixDSOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);

    this.instanceSettings = instanceSettings;
    this.enableDebugLog = config.buildInfo.env === 'development';

    this.annotations = {
      QueryEditor: AnnotationQueryEditor,
      prepareAnnotation: migrations.prepareAnnotation,
    };

    // General data source settings
    this.datasourceId = instanceSettings.id;
    this.name = instanceSettings.name;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;

    const jsonData = migrations.migrateDSConfig(instanceSettings.jsonData);

    // Use trends instead history since specified time
    this.trends = jsonData.trends;
    this.trendsFrom = jsonData.trendsFrom || '7d';
    this.trendsRange = jsonData.trendsRange || '4d';

    // Set cache update interval
    const ttl = jsonData.cacheTTL || '1h';
    this.cacheTTL = utils.parseInterval(ttl);

    // Other options
    this.disableReadOnlyUsersAck = jsonData.disableReadOnlyUsersAck;
    this.disableDataAlignment = jsonData.disableDataAlignment;

    // Direct DB Connection options
    this.enableDirectDBConnection = jsonData.dbConnectionEnable || false;
    this.dbConnectionDatasourceId = jsonData.dbConnectionDatasourceId;
    this.dbConnectionDatasourceName = jsonData.dbConnectionDatasourceName;
    this.dbConnectionRetentionPolicy = jsonData.dbConnectionRetentionPolicy;

    const zabbixOptions = {
      basicAuth: this.basicAuth,
      withCredentials: this.withCredentials,
      cacheTTL: this.cacheTTL,
      enableDirectDBConnection: this.enableDirectDBConnection,
      dbConnectionDatasourceId: this.dbConnectionDatasourceId,
      dbConnectionDatasourceName: this.dbConnectionDatasourceName,
      dbConnectionRetentionPolicy: this.dbConnectionRetentionPolicy,
      datasourceId: this.datasourceId,
    };

    this.zabbix = new Zabbix(zabbixOptions);
  }

  ////////////////////////
  // Datasource methods //
  ////////////////////////
  /**
   * Query panel data. Calls for each panel in dashboard.
   * @param  {Object} request   Contains time range, targets and other info.
   * @return {Object} Grafana metrics object with timeseries data for each target.
   */
  query(request: DataQueryRequest<ZabbixMetricsQuery>): Observable<DataQueryResponse> {
    trackRequest(request);

    // Migrate old targets
    const requestTargets = request.targets
      .map((t) => {
        // Prevent changes of original object
        const target = _.cloneDeep(t);
        return migrations.migrate(target);
      })
      .map((target) => {
        let ds = getDataSourceSrv().getInstanceSettings(target?.datasource);
        if (ds?.rawRef?.uid) {
          return { ...target, datasource: { ...target?.datasource, uid: ds.rawRef?.uid } };
        }
        return target;
      });

    const interpolatedTargets = this.interpolateVariablesInQueries(requestTargets, request.scopedVars);
    const backendResponse = super.query({ ...request, targets: interpolatedTargets.filter(this.isBackendTarget) });
    const dbConnectionResponsePromise = this.dbConnectionQuery({ ...request, targets: interpolatedTargets });
    const frontendResponsePromise = this.frontendQuery({ ...request, targets: interpolatedTargets });
    const annotationResponsePromise = this.annotationRequest({ ...request, targets: interpolatedTargets });
    const applyFEFuncs = (queryResponse: DataQueryResponse) =>
      this.applyFrontendFunctions(queryResponse, {
        ...request,
        targets: interpolatedTargets.filter(this.isBackendTarget),
      });

    return backendResponse.pipe(
      map(applyFEFuncs),
      map(responseHandler.convertZabbixUnits),
      map(this.convertToWide),
      switchMap((queryResponse) =>
        from(Promise.all([dbConnectionResponsePromise, frontendResponsePromise, annotationResponsePromise])).pipe(
          map(([dbConnectionRes, frontendRes, annotationRes]) =>
            this.mergeQueries(queryResponse, dbConnectionRes, frontendRes, annotationRes)
          )
        )
      )
    );
  }

  async frontendQuery(request: DataQueryRequest<ZabbixMetricsQuery>): Promise<DataQueryResponse> {
    const frontendTargets = request.targets.filter((t) => !(this.isBackendTarget(t) || this.isDBConnectionTarget(t)));
    const oldVersionTargets = frontendTargets
      .filter((target) => (target as any).itservice && !target.itServiceFilter)
      .map((t) => t.refId);
    const promises = _.map(frontendTargets, (target) => {
      // Don't request for hidden targets
      if (target.hide) {
        return [];
      }

      // Add range variables
      request.scopedVars = Object.assign({}, request.scopedVars, utils.getRangeScopedVars(request.range));
      const timeRange = this.buildTimeRange(request, target);

      if (target.queryType === c.MODE_TEXT) {
        // Text query
        // Don't request undefined targets
        if (!target.group || !target.host || !target.item) {
          return [];
        }
        return this.queryTextData(target, timeRange);
      } else if (target.queryType === c.MODE_ITSERVICE) {
        // IT services query
        const isOldVersion = oldVersionTargets.includes(target.refId);
        return this.queryITServiceData(target, timeRange, request, isOldVersion);
      } else if (target.queryType === c.MODE_TRIGGERS) {
        // Triggers query
        return this.queryTriggersData(target, timeRange, request);
      } else if (target.queryType === c.MODE_PROBLEMS) {
        // Problems query
        return this.queryProblems(target, timeRange, request);
      } else if (target.queryType === c.MODE_MACROS) {
        // UserMacro query
        return this.queryUserMacrosData(target);
      } else {
        return [];
      }
    });

    // Data for panel (all targets)
    return Promise.all(_.flatten(promises))
      .then(_.flatten)
      .then((data) => {
        if (
          data &&
          data.length > 0 &&
          isDataFrame(data[0]) &&
          !utils.isProblemsDataFrame(data[0]) &&
          !utils.isMacrosDataFrame(data[0]) &&
          !utils.nonTimeSeriesDataFrame(data[0])
        ) {
          data = responseHandler.alignFrames(data);
          if (responseHandler.isConvertibleToWide(data)) {
            console.log('Converting response to the wide format');
            data = responseHandler.convertToWide(data);
          }
        }
        return { data };
      });
  }

  async dbConnectionQuery(request: DataQueryRequest<any>): Promise<DataQueryResponse> {
    const targets = request.targets.filter(this.isDBConnectionTarget);

    const queries = _.compact(
      targets.map((target) => {
        // Don't request for hidden targets
        if (target.hide) {
          return [];
        }

        // Add range variables
        request.scopedVars = Object.assign({}, request.scopedVars, utils.getRangeScopedVars(request.range));
        const timeRange = this.buildTimeRange(request, target);
        const useTrends = this.isUseTrends(timeRange, target);

        if (!target.queryType || target.queryType === c.MODE_METRICS) {
          return this.queryNumericData(target, timeRange, useTrends, request);
        } else if (target.queryType === c.MODE_ITEMID) {
          // Item ID query
          if (!target.itemids) {
            return [];
          }
          return this.queryItemIdData(target, timeRange, useTrends, request);
        } else {
          return [];
        }
      })
    );

    const promises: Promise<DataQueryResponse> = Promise.all(queries)
      .then(_.flatten)
      .then((data) => ({ data }));

    return promises;
  }

  buildTimeRange(request, target) {
    let timeFrom = Math.ceil(dateMath.parse(request.range.from) / 1000);
    let timeTo = Math.ceil(dateMath.parse(request.range.to) / 1000);

    // Apply Time-related functions (timeShift(), etc)
    const timeFunctions = utils.bindFunctionDefs(target.functions, 'Time');
    if (timeFunctions.length) {
      const [time_from, time_to] = utils.sequence(timeFunctions)([timeFrom, timeTo]);
      timeFrom = time_from;
      timeTo = time_to;
    }
    return [timeFrom, timeTo];
  }

  /**
   * Query target data for Metrics
   */
  async queryNumericData(target, timeRange, useTrends, request): Promise<any> {
    const getItemOptions = {
      itemtype: 'num',
    };

    const items = await this.zabbix.getItemsFromTarget(target, getItemOptions);

    const queryStart = new Date().getTime();
    const result = await this.queryNumericDataForItems(items, target, timeRange, useTrends, request);
    const queryEnd = new Date().getTime();

    if (this.enableDebugLog) {
      console.log(`Datasource::Performance Query Time (${this.name}): ${queryEnd - queryStart}`);
    }

    return this.handleBackendPostProcessingResponse(result, request, target);
  }

  /**
   * Query history for numeric items
   */
  async queryNumericDataForItems(items, target: ZabbixMetricsQuery, timeRange, useTrends, request) {
    let history;
    request.valueType = this.getTrendValueType(target);
    request.consolidateBy = utils.getConsolidateBy(target) || request.valueType;

    if (useTrends) {
      history = await this.zabbix.getTrends(items, timeRange, request);
    } else {
      history = await this.zabbix.getHistoryTS(items, timeRange, request);
    }

    const range = {
      from: timeRange[0],
      to: timeRange[1],
    };
    return await this.invokeDataProcessingQuery(history, target, range);
  }

  async invokeDataProcessingQuery(timeSeriesData, query, timeRange) {
    // Request backend for data processing
    const requestOptions: BackendSrvRequest = {
      url: `/api/datasources/${this.datasourceId}/resources/db-connection-post`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      hideFromInspector: false,
      data: {
        series: timeSeriesData,
        query,
        timeRange,
      },
    };

    const response: any = await lastValueFrom(getBackendSrv().fetch<any>(requestOptions));
    return response.data;
  }

  handleBackendPostProcessingResponse(response, request, target) {
    const frames = [];
    for (const frameJSON of response) {
      const frame = dataFrameFromJSON(frameJSON);
      frame.refId = target.refId;
      frames.push(frame);
    }

    const resp = { data: frames };
    this.sortByRefId(resp);
    this.applyFrontendFunctions(resp, request);
    if (responseHandler.isConvertibleToWide(resp.data)) {
      console.log('Converting response to the wide format');
      resp.data = responseHandler.convertToWide(resp.data);
    }

    return resp.data;
  }

  getTrendValueType(target) {
    // Find trendValue() function and get specified trend value
    const trendFunctions = _.map(metricFunctions.getCategories()['Trends'], 'name');
    const trendValueFunc = _.find(target.functions, (func) => {
      return _.includes(trendFunctions, func.def.name);
    });
    return trendValueFunc ? trendValueFunc.params[0] : 'avg';
  }

  sortByRefId(response: DataQueryResponse) {
    response.data.sort((a, b) => {
      if (a.refId < b.refId) {
        return -1;
      } else if (a.refId > b.refId) {
        return 1;
      }
      return 0;
    });
  }

  applyFrontendFunctions(response: DataQueryResponse, request: DataQueryRequest<any>) {
    for (let i = 0; i < response.data.length; i++) {
      const frame: DataFrame = response.data[i];
      const target = utils.getRequestTarget(request, frame.refId);

      // Apply alias functions
      const aliasFunctions = utils.bindFunctionDefs(target.functions, 'Alias');
      utils.sequence(aliasFunctions)(frame);
    }
    return response;
  }

  /**
   * Query target data for Text
   */
  queryTextData(target, timeRange) {
    const options = {
      itemtype: 'text',
    };
    return this.zabbix
      .getItemsFromTarget(target, options)
      .then((items) => {
        return this.zabbix.getHistoryText(items, timeRange, target);
      })
      .then((result) => {
        if (target.resultFormat !== 'table') {
          return result.map((s) => responseHandler.seriesToDataFrame(s, target, [], FieldType.string));
        }
        return result;
      });
  }

  /**
   * Query target data for Item ID
   */
  queryItemIdData(target, timeRange, useTrends, options) {
    let itemids = target.itemids;
    const templateSrv = getTemplateSrv();
    itemids = templateSrv.replace(itemids, options.scopedVars, utils.zabbixItemIdsTemplateFormat);
    itemids = _.map(itemids.split(','), (itemid) => itemid.trim());

    if (!itemids) {
      return [];
    }

    return this.zabbix.getItemsByIDs(itemids).then((items) => {
      return this.queryNumericDataForItems(items, target, timeRange, useTrends, options);
    });
  }

  /**
   * Query target data for IT Services
   */
  async queryITServiceData(
    target: ZabbixMetricsQuery,
    timeRange: number[],
    request: DataQueryRequest<ZabbixMetricsQuery>,
    isOldVersion: boolean
  ) {
    // Don't show undefined and hidden targets
    if (target.hide || (!(target as any).itservice && !target.itServiceFilter) || !target.slaProperty) {
      return [];
    }

    let itservices = await this.zabbix.getITServices(target.itServiceFilter);
    if (isOldVersion) {
      itservices = _.filter(itservices, { serviceid: (target as any).itservice?.serviceid });
    }
    if (target.slaFilter !== undefined) {
      const slas = await this.zabbix.getSLAs(target.slaFilter);
      const result = await this.zabbix.getSLI(itservices, slas, timeRange, target, request);
      // Apply alias functions
      const aliasFunctions = utils.bindFunctionDefs(target.functions, 'Alias');
      utils.sequence(aliasFunctions)(result);
      return result;
    }
    const itservicesdp = await this.zabbix.getSLA(itservices, timeRange, target, request);
    const backendRequest = responseHandler.itServiceResponseToTimeSeries(itservicesdp, target.slaInterval);
    const processedResponse = await this.invokeDataProcessingQuery(backendRequest, target, {});
    return this.handleBackendPostProcessingResponse(processedResponse, request, target);
  }

  async queryUserMacrosData(target) {
    const groupFilter = target.group.filter;
    const hostFilter = target.host.filter;
    const macroFilter = target.macro.filter;
    const macros = await this.zabbix.getUMacros(groupFilter, hostFilter, macroFilter);
    const hostmacroids = _.map(macros, 'hostmacroid');
    const userMacros = await this.zabbix.getUserMacros(hostmacroids);
    return responseHandler.handleMacro(userMacros, target);
  }

  async queryTriggersData(target: ZabbixMetricsQuery, timeRange, request) {
    if (target.countTriggersBy === 'items') {
      return this.queryTriggersICData(target, timeRange);
    } else if (target.countTriggersBy === 'problems') {
      return this.queryTriggersPCData(target, timeRange, request);
    }

    const [hosts, apps] = await this.zabbix.getHostsApsFromTarget(target);
    if (!hosts.length) {
      return Promise.resolve([]);
    }

    const groupFilter = target.group.filter;
    const groups = await this.zabbix.getGroups(groupFilter);

    const hostids = hosts?.map((h) => h.hostid);
    const appids = apps?.map((a) => a.applicationid);
    const options = utils.getTriggersOptions(target, timeRange);

    // variable interpolation builds regex-like string, so we should trim it.
    const tagsFilterStr = target.tags.filter.replace('/^', '').replace('$/', '');
    const tags = utils.parseTags(tagsFilterStr);
    tags.forEach((tag) => {
      // Zabbix uses {"tag": "<tag>", "value": "<value>", "operator": "<operator>"} format, where 1 means Equal
      tag.operator = 1;
    });
    if (tags && tags.length) {
      options.tags = tags;
    }

    const alerts = await this.zabbix.getHostAlerts(hostids, appids, options);
    return responseHandler.handleTriggersResponse(alerts, groups, timeRange, target);
  }

  async queryTriggersICData(target, timeRange) {
    const getItemOptions = { itemtype: 'num' };
    const [hosts, apps, items] = await this.zabbix.getHostsFromICTarget(target, getItemOptions);
    if (!hosts.length) {
      return Promise.resolve([]);
    }

    const groupFilter = target.group.filter;
    const groups = await this.zabbix.getGroups(groupFilter);

    const hostids = hosts?.map((h) => h.hostid);
    const appids = apps?.map((a) => a.applicationid);
    const itemids = items?.map((i) => i.itemid);
    if (!itemids.length) {
      return Promise.resolve([]);
    }

    const options = utils.getTriggersOptions(target, timeRange);
    const alerts = await this.zabbix.getHostICAlerts(hostids, appids, itemids, options);
    return responseHandler.handleTriggersResponse(alerts, groups, timeRange, target);
  }

  async queryTriggersPCData(target: ZabbixMetricsQuery, timeRange, request) {
    const [timeFrom, timeTo] = timeRange;
    // variable interpolation builds regex-like string, so we should trim it.
    const tagsFilterStr = target.tags.filter.replace('/^', '').replace('$/', '');
    const tags = utils.parseTags(tagsFilterStr);
    tags.forEach((tag) => {
      // Zabbix uses {"tag": "<tag>", "value": "<value>", "operator": "<operator>"} format, where 1 means Equal
      tag.operator = 1;
    });

    const problemsOptions: any = {
      minSeverity: target.options?.minSeverity,
      limit: target.options?.limit,
    };

    if (tags && tags.length) {
      problemsOptions.tags = tags;
    }

    if (target.options?.acknowledged === 0 || target.options?.acknowledged === 1) {
      problemsOptions.acknowledged = target.options?.acknowledged ? true : false;
    }

    if (target.options?.minSeverity) {
      let severities = [0, 1, 2, 3, 4, 5].filter((v) => v >= target.options?.minSeverity);
      if (target.options?.severities) {
        severities = severities.filter((v) => target.options?.severities.includes(v));
      }
      problemsOptions.severities = severities;
    }

    if (target.options.useTimeRange) {
      problemsOptions.timeFrom = timeFrom;
      problemsOptions.timeTo = timeTo;
    }

    const [hosts, apps, triggers] = await this.zabbix.getHostsFromPCTarget(target, problemsOptions);
    if (!hosts.length) {
      return Promise.resolve([]);
    }

    const groupFilter = target.group.filter;
    const groups = await this.zabbix.getGroups(groupFilter);

    const hostids = hosts?.map((h) => h.hostid);
    const appids = apps?.map((a) => a.applicationid);
    const triggerids = triggers.map((t) => t.triggerid);
    const options: any = {
      minSeverity: target.options?.minSeverity,
      acknowledged: target.options?.acknowledged,
      count: target.options.count,
    };
    if (target.options.useTimeRange) {
      options.timeFrom = timeFrom;
      options.timeTo = timeTo;
    }

    const alerts = await this.zabbix.getHostPCAlerts(hostids, appids, triggerids, options);
    return responseHandler.handleTriggersResponse(alerts, groups, timeRange, target);
  }

  async queryProblems(target: ZabbixMetricsQuery, timeRange, options) {
    const [timeFrom, timeTo] = timeRange;
    const userIsEditor = contextSrv.isEditor || contextSrv.isGrafanaAdmin;

    let showAckButton = true;

    const showProblems = target.showProblems || ShowProblemTypes.Problems;
    const showProxy = target.options.hostProxy;

    const getProxiesPromise = showProxy ? this.zabbix.getProxies() : () => [];
    showAckButton = !this.disableReadOnlyUsersAck || userIsEditor;

    // replaceTemplateVars() builds regex-like string, so we should trim it.
    const tagsFilterStr = target.tags.filter.replace('/^', '').replace('$/', '');
    const tags = utils.parseTags(tagsFilterStr);
    tags.forEach((tag) => {
      // Zabbix uses {"tag": "<tag>", "value": "<value>", "operator": "<operator>"} format, where 1 means Equal
      tag.operator = 1;
    });

    const problemsOptions: any = {
      recent: showProblems === ShowProblemTypes.Recent,
      minSeverity: target.options?.minSeverity,
      limit: target.options?.limit,
    };

    if (tags && tags.length) {
      problemsOptions.tags = tags;
    }

    if (target?.evaltype) {
      problemsOptions.evaltype = target?.evaltype;
    }

    if (target.options?.acknowledged === 0 || target.options?.acknowledged === 1) {
      problemsOptions.acknowledged = !!target.options?.acknowledged;
    }

    if (target.options?.severities?.length) {
      let severities = [0, 1, 2, 3, 4, 5].filter((v) => target.options?.severities.includes(v));
      problemsOptions.severities = severities;
    }

    let getProblemsPromise: Promise<ProblemDTO[]>;
    if (showProblems === ShowProblemTypes.History || target.options?.useTimeRange) {
      problemsOptions.timeFrom = timeFrom;
      problemsOptions.timeTo = timeTo;
      getProblemsPromise = this.zabbix.getProblemsHistory(
        target.group.filter,
        target.host.filter,
        target.application.filter,
        target.proxy.filter,
        problemsOptions
      );
    } else {
      getProblemsPromise = this.zabbix.getProblems(
        target.group.filter,
        target.host.filter,
        target.application.filter,
        target.proxy.filter,
        problemsOptions
      );
    }
    const getUsersPromise = this.zabbix.getUsers();

    let proxies;
    let zabbixUsers;
    const problemsPromises = Promise.all([getProblemsPromise, getProxiesPromise, getUsersPromise])
      .then(([problems, sourceProxies, users]) => {
        zabbixUsers = _.keyBy(users, 'userid');
        proxies = _.keyBy(sourceProxies, 'proxyid');
        return problems;
      })
      .then((problems) => problemsHandler.setMaintenanceStatus(problems))
      .then((problems) => problemsHandler.setAckButtonStatus(problems, showAckButton))
      .then((problems) => problemsHandler.filterTriggersPre(problems, target))
      .then((problems) => problemsHandler.sortProblems(problems, target))
      .then((problems) => problemsHandler.addTriggerDataSource(problems, target))
      .then((problems) => problemsHandler.formatAcknowledges(problems, zabbixUsers))
      .then((problems) => problemsHandler.addTriggerHostProxy(problems, proxies));

    return problemsPromises.then((problems) => {
      const problemsDataFrame = problemsHandler.toDataFrame(problems, target);
      return problemsDataFrame;
    });
  }

  /**
   * Test connection to Zabbix API and external history DB.
   */
  async testDatasource() {
    try {
      const testResult = await super.testDatasource();
      return this.zabbix.testDataSource().then((dbConnectorStatus) => {
        let message = testResult.message;
        if (dbConnectorStatus) {
          message += `, DB connector type: ${dbConnectorStatus.dsType}`;
        }
        return {
          status: testResult.status,
          message: message,
          title: testResult.status,
        };
      });
    } catch (error: any) {
      if (error instanceof ZabbixAPIError) {
        return Promise.reject({
          status: 'error',
          message: error.message,
          error: new HealthCheckError(error.message, {}),
        });
      } else if (error.data && error.data.message) {
        return Promise.reject({
          status: 'error',
          message: error.data.message,
          error: new HealthCheckError(error.data.message, {}),
        });
      } else if (typeof error === 'string') {
        return Promise.reject({
          status: 'error',
          message: error,
          error: new HealthCheckError(error, {}),
        });
      } else {
        return Promise.reject({
          status: 'error',
          message: 'Could not connect to given url',
          error: new HealthCheckError('Could not connect to given url', {}),
        });
      }
    }
  }

  ////////////////
  // Templating //
  ////////////////

  /**
   * Find metrics from templated request.
   *
   * @param  {LegacyVariableQuery} query Query from Templating
   * @param options
   * @return {string}       Metric name - group, host, app or item or list
   *                        of metrics in "{metric1, metric2,..., metricN}" format.
   */
  metricFindQuery(query: LegacyVariableQuery, options) {
    let resultPromise;
    let queryModel = _.cloneDeep(query);

    if (!query) {
      return Promise.resolve([]);
    }

    if (typeof query === 'string') {
      // Backward compatibility
      queryModel = utils.parseLegacyVariableQuery(query);
    }

    for (const prop of ['group', 'host', 'application', 'itemTag', 'item']) {
      queryModel[prop] = utils.replaceTemplateVars(this.templateSrv, queryModel[prop], {});
    }

    queryModel = queryModel as VariableQuery;
    const { group, host, application, item } = queryModel;

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
      case VariableQueryTypes.ItemTag:
        resultPromise = this.zabbix.getItemTags(queryModel.group, queryModel.host, queryModel.itemTag);
        break;
      case VariableQueryTypes.Item:
        resultPromise = this.zabbix.getItems(
          queryModel.group,
          queryModel.host,
          queryModel.application,
          queryModel.itemTag,
          queryModel.item,
          { showDisabledItems: queryModel.showDisabledItems }
        );
        break;
      case VariableQueryTypes.ItemValues:
        const range = options?.range;
        resultPromise = this.zabbix.getItemValues(group, host, application, item, { range });
        break;
      default:
        resultPromise = Promise.resolve([]);
        break;
    }

    return resultPromise.then((metrics) => {
      return _.map(metrics, utils.formatMetric);
    });
  }

  targetContainsTemplate(target: ZabbixMetricsQuery): boolean {
    const templateSrv = getTemplateSrv() as any;
    return (
      templateSrv.variableExists(target.group?.filter) ||
      templateSrv.variableExists(target.host?.filter) ||
      templateSrv.variableExists(target.application?.filter) ||
      templateSrv.variableExists(target.itemTag?.filter) ||
      templateSrv.variableExists(target.item?.filter) ||
      templateSrv.variableExists(target.macro?.filter) ||
      templateSrv.variableExists(target.proxy?.filter) ||
      templateSrv.variableExists(target.trigger?.filter) ||
      templateSrv.variableExists(target.textFilter) ||
      templateSrv.variableExists(target.itServiceFilter)
    );
  }

  /////////////////
  // Annotations //
  /////////////////

  async annotationRequest(request: DataQueryRequest<any>): Promise<DataQueryResponse> {
    const targets = request.targets.filter((t) => t.fromAnnotations);
    if (!targets.length) {
      return Promise.resolve({ data: [] });
    }

    const events = await this.annotationQueryLegacy({ ...request, targets });
    return { data: [toDataFrame(events)] };
  }

  annotationQueryLegacy(options) {
    const timeRange = options.range || options.rangeRaw;
    const timeFrom = Math.ceil(dateMath.parse(timeRange.from) / 1000);
    const timeTo = Math.ceil(dateMath.parse(timeRange.to) / 1000);
    const annotation = options.targets[0];

    // Show all triggers
    const problemsOptions: any = {
      value: annotation.options.showOkEvents ? ['0', '1'] : '1',
      valueFromEvent: true,
      timeFrom,
      timeTo,
    };

    if (annotation.options.minSeverity) {
      const severities = [0, 1, 2, 3, 4, 5].filter((v) => v >= Number(annotation.options.minSeverity));
      problemsOptions.severities = severities;
    }

    const groupFilter = annotation.group.filter;
    const hostFilter = annotation.host.filter;
    const appFilter = annotation.application.filter;
    const proxyFilter = undefined;

    return this.zabbix
      .getProblemsHistory(groupFilter, hostFilter, appFilter, proxyFilter, problemsOptions)
      .then((problems) => {
        // Filter triggers by description
        const problemName = annotation.trigger.filter;
        if (utils.isRegex(problemName)) {
          problems = _.filter(problems, (p) => {
            return utils.buildRegex(problemName).test(p.description);
          });
        } else if (problemName) {
          problems = _.filter(problems, (p) => {
            return p.description === problemName;
          });
        }

        // Hide acknowledged events if option enabled
        if (annotation.hideAcknowledged) {
          problems = _.filter(problems, (p) => {
            return !p.acknowledges?.length;
          });
        }

        return _.map(problems, (p) => {
          const formattedAcknowledges = utils.formatAcknowledges(p.acknowledges);

          let annotationTags: string[] = [];
          if (annotation.showHostname) {
            annotationTags = _.map(p.hosts, 'name');
          }

          return {
            title: p.value === '1' ? 'Problem' : 'OK',
            time: p.timestamp * 1000,
            annotation: annotation,
            text: p.name + formattedAcknowledges,
            tags: annotationTags,
          };
        });
      });
  }

  isUseTrends(timeRange, target: ZabbixMetricsQuery) {
    if (target.options.useTrends === 'false') {
      return false;
    }
    const [timeFrom, timeTo] = timeRange;
    const useTrendsFrom = Math.ceil(dateMath.parse('now-' + this.trendsFrom) / 1000);
    const useTrendsRange = Math.ceil(utils.parseInterval(this.trendsRange) / 1000);
    const useTrendsToggle = target.options.useTrends === 'true';
    const useTrends =
      (useTrendsToggle || this.trends) && (timeFrom < useTrendsFrom || timeTo - timeFrom > useTrendsRange);
    return useTrends;
  }

  isBackendTarget = (target: any): boolean => {
    if (this.enableDirectDBConnection) {
      return false;
    }

    return target.queryType === c.MODE_METRICS || target.queryType === c.MODE_ITEMID;
  };

  isDBConnectionTarget = (target: any): boolean => {
    return this.enableDirectDBConnection && (target.queryType === c.MODE_METRICS || target.queryType === c.MODE_ITEMID);
  };

  mergeQueries(
    queryResponse: DataQueryResponse,
    dbConnectionResponse?: DataQueryResponse,
    frontendResponse?: DataQueryResponse,
    annotationResponse?: DataQueryResponse
  ): DataQueryResponse {
    const mergedResponse: DataQueryResponse = {
      ...queryResponse,
      data: queryResponse.data ? [...queryResponse.data] : [],
    };

    if (dbConnectionResponse?.data) {
      mergedResponse.data = mergedResponse.data.concat(dbConnectionResponse.data);
    }
    if (frontendResponse?.data) {
      mergedResponse.data = mergedResponse.data.concat(frontendResponse.data);
    }
    if (annotationResponse?.data) {
      mergedResponse.data = mergedResponse.data.concat(annotationResponse.data);
    }

    return mergedResponse;
  }

  convertToWide(response: DataQueryResponse) {
    if (responseHandler.isConvertibleToWide(response.data)) {
      response.data = responseHandler.convertToWide(response.data);
    }
    return response;
  }
  interpolateVariablesInQueries(queries: ZabbixMetricsQuery[], scopedVars: ScopedVars): ZabbixMetricsQuery[] {
    if (!queries || queries.length === 0) {
      return [];
    }
    return queries.map((query) => {
      // backwardsCompatibility
      const isOldVersion: boolean = (query as any).itservice && !query.itServiceFilter;
      return {
        ...query,
        itServiceFilter: isOldVersion
          ? '/.*/'
          : utils.replaceTemplateVars(this.templateSrv, query.itServiceFilter, scopedVars),
        slaFilter: utils.replaceTemplateVars(this.templateSrv, query.slaFilter, scopedVars),
        itemids: utils.replaceTemplateVars(
          this.templateSrv,
          query.itemids,
          scopedVars,
          utils.zabbixItemIdsTemplateFormat
        ),
        textFilter: utils.replaceTemplateVars(this.templateSrv, query.textFilter, scopedVars),
        functions: utils.replaceVariablesInFuncParams(this.templateSrv, query.functions, scopedVars),
        tags: {
          ...query.tags,
          filter: utils.replaceTemplateVars(this.templateSrv, query.tags?.filter, scopedVars),
        },
        group: {
          ...query.group,
          filter: utils.replaceTemplateVars(this.templateSrv, query.group?.filter, scopedVars),
        },
        host: {
          ...query.host,
          filter: utils.replaceTemplateVars(this.templateSrv, query.host?.filter, scopedVars),
        },
        application: {
          ...query.application,
          filter: utils.replaceTemplateVars(this.templateSrv, query.application?.filter, scopedVars),
        },
        proxy: {
          ...query.proxy,
          filter: utils.replaceTemplateVars(this.templateSrv, query.proxy?.filter, scopedVars),
        },
        trigger: {
          ...query.trigger,
          filter: utils.replaceTemplateVars(this.templateSrv, query.trigger?.filter, scopedVars),
        },
        itemTag: {
          ...query.itemTag,
          filter: utils.replaceTemplateVars(this.templateSrv, query.itemTag?.filter, scopedVars),
        },
        item: {
          ...query.item,
          filter: utils.replaceTemplateVars(this.templateSrv, query.item?.filter, scopedVars),
        },
      };
    });
  }
}
