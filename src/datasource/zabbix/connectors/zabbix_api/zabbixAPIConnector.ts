import _ from 'lodash';
import semver from 'semver';
import kbn from 'grafana/app/core/utils/kbn';
import * as utils from '../../../utils';
import { MIN_SLA_INTERVAL, ZBX_ACK_ACTION_ADD_MESSAGE, ZBX_ACK_ACTION_NONE } from '../../../constants';
import { ShowProblemTypes } from '../../../types/query';
import { ZBXProblem, ZBXTrigger } from '../../../types';
import { APIExecuteScriptResponse, JSONRPCError, ZBXScript } from './types';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { rangeUtil } from '@grafana/data';
import { parseItemTag } from '../../../utils';

const DEFAULT_ZABBIX_VERSION = '3.0.0';

// Backward compatibility. Since Grafana 7.2 roundInterval() func was moved to @grafana/data package
const roundInterval: (interval: number) => number = rangeUtil?.roundInterval || kbn.roundInterval || kbn.round_interval;

/**
 * Zabbix API Wrapper.
 * Creates Zabbix API instance with given parameters (url, credentials and other).
 * Wraps API calls and provides high-level methods.
 */
export class ZabbixAPIConnector {
  backendAPIUrl: string;
  requestOptions: { basicAuth: any; withCredentials: boolean };
  getTrend: (items: any, timeFrom: any, timeTill: any) => Promise<any[]>;
  version: string;
  getVersionPromise: Promise<string>;
  datasourceId: number;

  constructor(basicAuth: any, withCredentials: boolean, datasourceId: number) {
    this.datasourceId = datasourceId;
    this.backendAPIUrl = `/api/datasources/${this.datasourceId}/resources/zabbix-api`;

    this.requestOptions = {
      basicAuth: basicAuth,
      withCredentials: withCredentials,
    };

    this.getTrend = this.getTrend_ZBXNEXT1193;
    //getTrend = getTrend_30;

    this.initVersion();
  }

  //////////////////////////
  // Core method wrappers //
  //////////////////////////

  request(method: string, params?: any) {
    if (!this.version) {
      return this.initVersion().then(() => this.request(method, params));
    }

    return this.backendAPIRequest(method, params);
  }

  async backendAPIRequest(method: string, params: any = {}) {
    const requestOptions: BackendSrvRequest = {
      url: this.backendAPIUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      hideFromInspector: false,
      data: {
        datasourceId: this.datasourceId,
        method,
        params,
      },
    };

    // Set request options for basic auth
    if (this.requestOptions.basicAuth || this.requestOptions.withCredentials) {
      requestOptions.withCredentials = true;
    }
    if (this.requestOptions.basicAuth) {
      requestOptions.headers.Authorization = this.requestOptions.basicAuth;
    }

    const response = await getBackendSrv().fetch<any>(requestOptions).toPromise();
    return response?.data?.result;
  }

  /**
   * Get Zabbix API version
   */
  getVersion() {
    return this.backendAPIRequest('apiinfo.version');
  }

  initVersion(): Promise<string> {
    if (this.version) {
      return Promise.resolve(this.version);
    }

    if (!this.getVersionPromise) {
      this.getVersionPromise = Promise.resolve(
        this.getVersion().then((version) => {
          if (version) {
            console.log(`Zabbix version detected: ${version}`);
          } else {
            console.log(`Failed to detect Zabbix version, use default ${DEFAULT_ZABBIX_VERSION}`);
          }

          this.version = version || DEFAULT_ZABBIX_VERSION;
          this.getVersionPromise = null;
          return version;
        })
      );
    }
    return this.getVersionPromise;
  }

  isZabbix54OrHigher() {
    return semver.gte(this.version, '5.4.0');
  }

  isZabbix72OrHigher() {
    return semver.gte(this.version, '7.2.0');
  }

  ////////////////////////////////
  // Zabbix API method wrappers //
  ////////////////////////////////

  acknowledgeEvent(eventid: string, message: string, action?: number, severity?: number) {
    if (!action) {
      action = semver.gte(this.version, '4.0.0') ? ZBX_ACK_ACTION_ADD_MESSAGE : ZBX_ACK_ACTION_NONE;
    }

    const params: any = {
      eventids: eventid,
      message: message,
      action: action,
    };

    if (severity !== undefined) {
      params.severity = severity;
    }

    return this.request('event.acknowledge', params);
  }

  getGroups() {
    const params = {
      output: ['name', 'groupid'],
      sortfield: 'name',
    };

    // Zabbix v7.0 and later deprecated `real_hosts` parameter and replaced it with `with_hosts`
    if (semver.gte(this.version, '7.0.0')) {
      params['with_hosts'] = true;
    } else {
      params['real_hosts'] = true;
    }

    return this.request('hostgroup.get', params);
  }

  getHosts(groupids): Promise<any[]> {
    const params: any = {
      output: ['hostid', 'name', 'host'],
      sortfield: 'name',
    };
    if (groupids) {
      params.groupids = groupids;
    }

    return this.request('host.get', params);
  }

  async getApps(hostids): Promise<any[]> {
    if (this.isZabbix54OrHigher()) {
      return [];
    }

    const params = {
      output: 'extend',
      hostids: hostids,
    };

    return this.request('application.get', params);
  }

  /**
   * Get Zabbix items
   * @param  {[type]} hostids  host ids
   * @param  {[type]} appids   application ids
   * @param  {String} itemtype 'num' or 'text'
   * @return {[type]}          array of items
   */
  getItems(hostids, appids, itemtype, itemTagFilter?: string): Promise<any[]> {
    const params: any = {
      output: ['itemid', 'name', 'key_', 'value_type', 'hostid', 'status', 'state', 'units', 'valuemapid', 'delay'],
      sortfield: 'name',
      webitems: true,
      filter: {},
      selectHosts: ['hostid', 'name', 'host'],
    };
    if (hostids) {
      params.hostids = hostids;
    }
    if (appids) {
      params.applicationids = appids;
    }
    if (itemtype === 'num') {
      // Return only numeric metrics
      params.filter.value_type = [0, 3];
    }
    if (itemtype === 'text') {
      // Return only text metrics
      params.filter.value_type = [1, 2, 4];
    }

    if (this.isZabbix54OrHigher()) {
      params.selectTags = 'extend';
      if (itemTagFilter) {
        const allTags = itemTagFilter.split(',');
        let tagsParam = [];
        for (let i = 0; i < allTags.length; i++) {
          const tag = parseItemTag(allTags[i]);
          tagsParam.push({ tag: tag.tag, value: tag.value, operator: '1' });
        }
        params.tags = tagsParam;
        // Use OR eval type
        params.evaltype = 2;
      }
    }

    return this.request('item.get', params).then(utils.expandItems);
  }

  getItemsByIDs(itemids) {
    const params: any = {
      itemids: itemids,
      output: ['itemid', 'name', 'key_', 'value_type', 'hostid', 'status', 'state', 'units', 'valuemapid', 'delay'],
      webitems: true,
      selectHosts: ['hostid', 'name'],
    };

    if (this.isZabbix54OrHigher()) {
      params.selectTags = 'extend';
    }

    return this.request('item.get', params).then((items) => utils.expandItems(items));
  }

  getMacros(hostids) {
    const params = {
      output: 'extend',
      hostids: hostids,
    };

    return this.request('usermacro.get', params);
  }

  getUserMacros(hostmacroids) {
    const params = {
      output: 'extend',
      hostmacroids: hostmacroids,
      selectHosts: ['hostid', 'name'],
    };
    return this.request('usermacro.get', params);
  }

  getGlobalMacros() {
    const params = {
      output: 'extend',
      globalmacro: true,
    };

    return this.request('usermacro.get', params);
  }

  getLastValue(itemid) {
    const params = {
      output: ['lastvalue'],
      itemids: itemid,
    };
    return this.request('item.get', params).then((items) => (items.length ? items[0].lastvalue : null));
  }

  /**
   * Perform history query from Zabbix API
   *
   * @param  {Array}  items       Array of Zabbix item objects
   * @param  {Number} timeFrom   Time in seconds
   * @param  {Number} timeTill   Time in seconds
   * @return {Array}  Array of Zabbix history objects
   */
  getHistory(items, timeFrom, timeTill) {
    // Group items by value type and perform request for each value type
    const grouped_items = _.groupBy(items, 'value_type');
    const promises = _.map(grouped_items, (items, value_type) => {
      const itemids = _.map(items, 'itemid');
      const params: any = {
        output: 'extend',
        history: value_type,
        itemids: itemids,
        sortfield: 'clock',
        sortorder: 'ASC',
        time_from: timeFrom,
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (timeTill) {
        params.time_till = timeTill;
      }

      return this.request('history.get', params);
    });

    return Promise.all(promises).then(_.flatten);
  }

  /**
   * Perform trends query from Zabbix API
   * Use trends api extension from ZBXNEXT-1193 patch.
   *
   * @param  {Array}  items       Array of Zabbix item objects
   * @param  {Number} time_from   Time in seconds
   * @param  {Number} time_till   Time in seconds
   * @return {Array}  Array of Zabbix trend objects
   */
  getTrend_ZBXNEXT1193(items, timeFrom, timeTill) {
    // Group items by value type and perform request for each value type
    const grouped_items = _.groupBy(items, 'value_type');
    const promises = _.map(grouped_items, (items, value_type) => {
      const itemids = _.map(items, 'itemid');
      const params: any = {
        output: 'extend',
        trend: value_type,
        itemids: itemids,
        sortfield: 'clock',
        sortorder: 'ASC',
        time_from: timeFrom,
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (timeTill) {
        params.time_till = timeTill;
      }

      return this.request('trend.get', params);
    });

    return Promise.all(promises).then(_.flatten);
  }

  getTrend_30(items, time_from, time_till, value_type) {
    const self = this;
    const itemids = _.map(items, 'itemid');

    const params: any = {
      output: ['itemid', 'clock', value_type],
      itemids: itemids,
      time_from: time_from,
    };

    // Relative queries (e.g. last hour) don't include an end time
    if (time_till) {
      params.time_till = time_till;
    }

    return self.request('trend.get', params);
  }

  getITService(serviceids?: any[]) {
    const params = {
      output: 'extend',
      serviceids: serviceids,
    };
    return this.request('service.get', params);
  }

  // Returns services. Non-cached method (for getting actual service status).
  getServices(serviceids?: any[]) {
    const params = {
      output: 'extend',
      serviceids: serviceids,
    };
    return this.request('service.get', params);
  }

  getSLAList() {
    const params = {
      output: 'extend',
    };
    return this.request('sla.get', params);
  }

  getSLA(serviceids, timeRange, options) {
    const [timeFrom, timeTo] = timeRange;
    let intervals = [{ from: timeFrom, to: timeTo }];
    if (options.slaInterval === 'auto') {
      const interval = getSLAInterval(options.intervalMs);
      intervals = buildSLAIntervals(timeRange, interval);
    } else if (options.slaInterval !== 'none') {
      const interval = utils.parseInterval(options.slaInterval) / 1000;
      intervals = buildSLAIntervals(timeRange, interval);
    }

    const params: any = {
      serviceids,
      intervals,
    };

    return this.request('service.getsla', params);
  }

  async getSLA60(serviceids, timeRange, options) {
    const [timeFrom, timeTo] = timeRange;
    let intervals = [{ from: timeFrom, to: timeTo }];
    if (options.slaInterval === 'auto') {
      const interval = getSLAInterval(options.intervalMs);
      intervals = buildSLAIntervals(timeRange, interval);
    } else if (options.slaInterval !== 'none') {
      const interval = utils.parseInterval(options.slaInterval) / 1000;
      intervals = buildSLAIntervals(timeRange, interval);
    }

    const params: any = {
      output: 'extend',
      serviceids,
    };

    const slaObjects = await this.request('sla.get', params);
    if (slaObjects.length === 0) {
      return {};
    }
    const sla = slaObjects[0];

    // const periods = intervals.map(interval => ({
    //   period_from: interval.from,
    //   period_to: interval.to,
    // }));
    const sliParams: any = {
      slaid: sla.slaid,
      serviceids,
      period_from: timeFrom,
      period_to: timeTo,
      periods: Math.min(intervals.length, 100),
    };

    const sliResponse = await this.request('sla.getsli', sliParams);
    if (sliResponse.length === 0) {
      return {};
    }

    const slaLikeResponse: any = {};
    sliResponse.serviceids.forEach((serviceid) => {
      slaLikeResponse[serviceid] = {
        sla: [],
      };
    });
    sliResponse.sli.forEach((sliItem, i) => {
      sliItem.forEach((sli, j) => {
        slaLikeResponse[sliResponse.serviceids[j]].sla.push({
          downtimeTime: sli.downtime,
          okTime: sli.uptime,
          sla: sli.sli,
          from: sliResponse.periods[i].period_from,
          to: sliResponse.periods[i].period_to,
        });
      });
    });
    return slaLikeResponse;
  }

  async getSLI(slaid, serviceids, timeRange, options) {
    const [timeFrom, timeTo] = timeRange;
    let intervals = [{ from: timeFrom, to: timeTo }];
    if (options.slaInterval === 'auto') {
      const interval = getSLAInterval(options.intervalMs);
      intervals = buildSLAIntervals(timeRange, interval);
    } else if (options.slaInterval !== 'none') {
      const interval = utils.parseInterval(options.slaInterval) / 1000;
      intervals = buildSLAIntervals(timeRange, interval);
    }

    const sliParams: any = {
      slaid,
      serviceids,
      period_from: timeFrom,
      period_to: timeTo,
      periods: Math.min(intervals.length, 100),
    };

    const sliResponse = await this.request('sla.getsli', sliParams);
    return sliResponse;
  }

  getProblems(groupids, hostids, applicationids, options): Promise<ZBXProblem[]> {
    const { timeFrom, timeTo, recent, severities, limit, acknowledged, tags, evaltype } = options;

    const params: any = {
      output: 'extend',
      selectAcknowledges: 'extend',
      selectSuppressionData: 'extend',
      selectTags: 'extend',
      source: '0',
      object: '0',
      sortfield: ['eventid'],
      sortorder: 'DESC',
      evaltype: '0',
      // preservekeys: '1',
      groupids,
      hostids,
      applicationids,
      recent,
    };

    if (severities) {
      params.severities = severities;
    }

    if (acknowledged !== undefined) {
      params.acknowledged = acknowledged;
    }

    if (tags) {
      params.tags = tags;
    }

    if (evaltype) {
      params.evaltype = evaltype;
    }

    if (limit) {
      params.limit = limit;
    }

    if (timeFrom || timeTo) {
      params.time_from = timeFrom;
      params.time_till = timeTo;
    }

    return this.request('problem.get', params).then(utils.mustArray);
  }

  getTriggersByIds(triggerids: string[]) {
    const params = {
      output: 'extend',
      triggerids: triggerids,
      expandDescription: true,
      expandData: true,
      expandComment: true,
      expandExpression: true,
      monitored: true,
      skipDependent: true,
      selectGroups: ['name', 'groupid'],
      selectHosts: ['hostid', 'name', 'host', 'maintenance_status', 'description'],
      selectItems: ['itemid', 'name', 'key_', 'lastvalue'],
      // selectLastEvent: 'extend',
      // selectTags: 'extend',
      preservekeys: '1',
    };

    // Before version 7.0.0 proxy_hostid was used, after - proxyid
    if (semver.lt(this.version, '7.0.0')) {
      params.selectHosts.push('proxy_hostid');
    } else {
      params.selectHosts.push('proxyid');
    }

    return this.request('trigger.get', params).then(utils.mustArray);
  }

  getTriggers(groupids, hostids, applicationids, options) {
    const { showTriggers, maintenance, timeFrom, timeTo } = options;

    const params: any = {
      output: 'extend',
      groupids: groupids,
      hostids: hostids,
      applicationids: applicationids,
      expandDescription: true,
      expandData: true,
      expandComment: true,
      monitored: true,
      skipDependent: true,
      //only_true: true,
      filter: {
        value: 1,
      },
      selectGroups: ['groupid', 'name'],
      selectHosts: ['hostid', 'name', 'host', 'maintenance_status'],
      selectItems: ['itemid', 'name', 'key_', 'lastvalue'],
      selectLastEvent: 'extend',
      selectTags: 'extend',
    };

    // Before version 7.0.0 proxy_hostid was used, after - proxyid
    if (semver.lt(this.version, '7.0.0')) {
      params.selectHosts.push('proxy_hostid');
    } else {
      params.selectHosts.push('proxyid');
    }

    if (showTriggers === ShowProblemTypes.Problems) {
      params.filter.value = 1;
    } else if (showTriggers === ShowProblemTypes.Recent || showTriggers === ShowProblemTypes.History) {
      params.filter.value = [0, 1];
    }

    if (maintenance) {
      params.maintenance = true;
    }

    if (timeFrom || timeTo) {
      params.lastChangeSince = timeFrom;
      params.lastChangeTill = timeTo;
    }

    return this.request('trigger.get', params);
  }

  getEvents(objectids, timeFrom, timeTo, showEvents, limit) {
    const params: any = {
      output: 'extend',
      time_from: timeFrom,
      time_till: timeTo,
      objectids: objectids,
      select_acknowledges: 'extend',
      selectHosts: 'extend',
      value: showEvents,
    };

    if (limit) {
      params.limit = limit;
      params.sortfield = 'clock';
      params.sortorder = 'DESC';
    }

    return this.request('event.get', params).then(utils.mustArray);
  }

  getEventsHistory(groupids, hostids, applicationids, options) {
    const { timeFrom, timeTo, severities, limit, value, tags, evaltype } = options;

    const params: any = {
      output: 'extend',
      time_from: timeFrom,
      time_till: timeTo,
      value: '1',
      source: '0',
      object: '0',
      evaltype: '0',
      sortfield: ['eventid'],
      sortorder: 'DESC',
      select_acknowledges: 'extend',
      selectTags: 'extend',
      selectSuppressionData: ['maintenanceid', 'suppress_until'],
      groupids,
      hostids,
      applicationids,
    };

    if (limit) {
      params.limit = limit;
    }

    if (severities) {
      params.severities = severities;
    }

    if (value) {
      params.value = value;
    }

    if (tags) {
      params.tags = tags;
    }

    if (evaltype) {
      params.evaltype = evaltype;
    }

    return this.request('event.get', params).then(utils.mustArray);
  }

  getExtendedEventData(eventids) {
    const params = {
      output: 'extend',
      eventids: eventids,
      preservekeys: true,
      select_acknowledges: 'extend',
      selectTags: 'extend',
      sortfield: 'clock',
      sortorder: 'DESC',
    };

    return this.request('event.get', params);
  }

  getEventAlerts(eventids) {
    const params = {
      eventids: eventids,
      output: ['alertid', 'eventid', 'message', 'clock', 'error'],
      selectUsers: 'extend',
    };

    return this.request('alert.get', params);
  }

  getAcknowledges(eventids) {
    const params = {
      output: 'extend',
      eventids: eventids,
      preservekeys: true,
      select_acknowledges: 'extend',
      sortfield: 'clock',
      sortorder: 'DESC',
    };

    return this.request('event.get', params).then((events) => {
      return _.filter(events, (event) => event.acknowledges.length);
    });
  }

  getAlerts(itemids, timeFrom, timeTo) {
    const params: any = {
      output: 'extend',
      itemids: itemids,
      expandDescription: true,
      expandData: true,
      expandComment: true,
      monitored: true,
      skipDependent: true,
      //only_true: true,
      // filter: {
      //   value: 1
      // },
      selectLastEvent: 'extend',
    };

    if (timeFrom || timeTo) {
      params.lastChangeSince = timeFrom;
      params.lastChangeTill = timeTo;
    }

    return this.request('trigger.get', params);
  }

  async getHostAlerts(hostids, applicationids, options): Promise<ZBXTrigger[]> {
    const { minSeverity, acknowledged, tags, count, timeFrom, timeTo } = options;
    const params: any = {
      output: 'extend',
      hostids: hostids,
      min_severity: minSeverity,
      filter: { value: 1 },
      expandDescription: true,
      expandData: true,
      expandComment: true,
      monitored: true,
      skipDependent: true,
      selectLastEvent: 'extend',
      selectGroups: 'extend',
      selectHosts: ['hostid', 'host', 'name'],
    };

    if (count && acknowledged !== 1) {
      params.countOutput = true;
      if (acknowledged === 0) {
        params.withLastEventUnacknowledged = true;
      }
    }

    if (applicationids && applicationids.length) {
      params.applicationids = applicationids;
    }

    if (timeFrom || timeTo) {
      params.lastChangeSince = timeFrom;
      params.lastChangeTill = timeTo;
    }

    if (tags) {
      params.tags = tags;
      params.evaltype = 0;
    }

    let triggers = await this.request('trigger.get', params);
    if (!count || acknowledged === 1) {
      triggers = filterTriggersByAcknowledge(triggers, acknowledged);
      if (count) {
        triggers = triggers.length;
      }
    }
    return triggers;
  }

  getHostICAlerts(hostids, applicationids, itemids, options) {
    const { minSeverity, acknowledged, count, timeFrom, timeTo } = options;
    const params: any = {
      output: 'extend',
      hostids: hostids,
      min_severity: minSeverity,
      filter: { value: 1 },
      expandDescription: true,
      expandData: true,
      expandComment: true,
      monitored: true,
      skipDependent: true,
      selectLastEvent: 'extend',
      selectGroups: 'extend',
      selectHosts: ['host', 'name'],
      selectItems: ['name', 'key_'],
    };

    if (count && acknowledged !== 1) {
      params.countOutput = true;
      if (acknowledged === 0) {
        params.withLastEventUnacknowledged = true;
      }
    }

    if (applicationids && applicationids.length) {
      params.applicationids = applicationids;
    }

    if (itemids && itemids.length) {
      params.itemids = itemids;
    }

    if (timeFrom || timeTo) {
      params.lastChangeSince = timeFrom;
      params.lastChangeTill = timeTo;
    }

    return this.request('trigger.get', params).then((triggers) => {
      if (!count || acknowledged === 1) {
        triggers = filterTriggersByAcknowledge(triggers, acknowledged);
        if (count) {
          triggers = triggers.length;
        }
      }
      return triggers;
    });
  }

  getHostPCAlerts(hostids, applicationids, triggerids, options) {
    const { minSeverity, acknowledged, count, timeFrom, timeTo } = options;
    const params: any = {
      output: 'extend',
      hostids: hostids,
      triggerids: triggerids,
      min_severity: minSeverity,
      filter: { value: 1 },
      expandDescription: true,
      expandData: true,
      expandComment: true,
      monitored: true,
      skipDependent: true,
      selectLastEvent: 'extend',
      selectGroups: 'extend',
      selectHosts: ['host', 'name'],
      selectItems: ['name', 'key_'],
    };

    if (count && acknowledged !== 0 && acknowledged !== 1) {
      params.countOutput = true;
    }

    if (applicationids && applicationids.length) {
      params.applicationids = applicationids;
    }

    if (timeFrom || timeTo) {
      params.lastChangeSince = timeFrom;
      params.lastChangeTill = timeTo;
    }

    return this.request('trigger.get', params).then((triggers) => {
      if (!count || acknowledged === 0 || acknowledged === 1) {
        triggers = filterTriggersByAcknowledge(triggers, acknowledged);
        if (count) {
          triggers = triggers.length;
        }
      }
      return triggers;
    });
  }

  getProxies() {
    const params = {
      output: ['proxyid'],
    };
    // Before version 7.0.0 host was used, after - name
    if (semver.lt(this.version, '7.0.0')) {
      params.output.push('host');
    } else {
      params.output.push('name');
    }

    return this.request('proxy.get', params);
  }

  getScripts(hostids: string[], options?: any): Promise<ZBXScript[]> {
    const params: any = {
      output: 'extend',
      hostids,
    };

    return this.request('script.get', params).then(utils.mustArray);
  }

  executeScript(hostid: string, scriptid: string): Promise<APIExecuteScriptResponse> {
    const params: any = {
      hostid,
      scriptid,
    };

    return this.request('script.execute', params);
  }

  getValueMappings() {
    const params = {
      output: 'extend',
      selectMappings: 'extend',
    };

    return this.request('valuemap.get', params);
  }

  getUsers() {
    const params = {
      output: ['userid', 'username', 'name', 'surname'],
    };

    return this.request('user.get', params);
  }
}

function filterTriggersByAcknowledge(triggers, acknowledged) {
  if (acknowledged === 0) {
    return _.filter(triggers, (trigger) => trigger.lastEvent.acknowledged === '0');
  } else if (acknowledged === 1) {
    return _.filter(triggers, (trigger) => trigger.lastEvent.acknowledged === '1');
  } else {
    return triggers;
  }
}

function getSLAInterval(intervalMs) {
  // Too many intervals may cause significant load on the database, so decrease number of resulting points
  const resolutionRatio = 100;
  const interval = roundInterval(intervalMs * resolutionRatio) / 1000;
  return Math.max(interval, MIN_SLA_INTERVAL);
}

function buildSLAIntervals(timeRange, interval) {
  let [timeFrom, timeTo] = timeRange;
  const intervals = [];

  // Align time range with calculated interval
  timeFrom = Math.floor(timeFrom / interval) * interval;
  timeTo = Math.ceil(timeTo / interval) * interval;

  for (let i = timeFrom; i <= timeTo - interval; i += interval) {
    intervals.push({
      from: i,
      to: i + interval,
    });
  }

  return intervals;
}

// Define zabbix API exception type
export class ZabbixAPIError {
  code: number;
  name: string;
  data: string;
  message: string;

  constructor(error: JSONRPCError) {
    this.code = error.code || null;
    this.name = error.message || '';
    this.data = error.data || '';
    this.message = 'Zabbix API Error: ' + this.name + ' ' + this.data;
  }

  toString() {
    return this.name + ' ' + this.data;
  }
}
