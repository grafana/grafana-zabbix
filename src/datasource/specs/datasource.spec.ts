import { DataQueryResponse, dateMath } from '@grafana/data';
import _ from 'lodash';
import { datasourceSrvMock, templateSrvMock } from '../../test-setup/mocks';
import { VariableQueryTypes } from '../types';
import { ZabbixDatasource } from 'datasource/datasource';
// firstValueFrom removed - tests call frontendQuery directly for text queries
import * as utils from '../utils';
import { from } from 'rxjs';

jest.mock(
  '@grafana/runtime',
  () => {
    const actual = jest.requireActual('@grafana/runtime');
    // Provide a custom query implementation that resolves backend + frontend + db + annotations
    // so tests relying on merged results receive expected data.
    if (actual && actual.DataSourceWithBackend && actual.DataSourceWithBackend.prototype) {
      // Resource calls (zabbix-api, db-connection-post) go through postResource
      actual.DataSourceWithBackend.prototype.postResource = jest.fn().mockResolvedValue({ result: '' });
      // @ts-ignore
      actual.DataSourceWithBackend.prototype.query = function (request: any) {
        const that: any = this;

        const backendResponse = Promise.resolve({ data: [] });
        const dbPromise = that.dbConnectionQuery ? that.dbConnectionQuery(request) : Promise.resolve({ data: [] });
        const fePromise = that.frontendQuery ? that.frontendQuery(request) : Promise.resolve({ data: [] });
        const annPromise = that.annotationRequest ? that.annotationRequest(request) : Promise.resolve({ data: [] });

        return from(
          Promise.all([backendResponse, dbPromise, fePromise, annPromise]).then(([backend, db, fe, ann]) => {
            const data: any[] = [];
            if (backend && backend.data) {
              data.push(...backend.data);
            }
            if (db && db.data) {
              data.push(...db.data);
            }
            if (fe && fe.data) {
              data.push(...fe.data);
            }
            if (ann && ann.data) {
              data.push(...ann.data);
            }
            return { data };
          })
        );
      };
    }

    return {
      ...actual,
      getBackendSrv: () => ({
        datasourceRequest: jest.fn().mockResolvedValue({ data: { result: '' } }),
        fetch: () => ({
          toPromise: () => jest.fn().mockResolvedValue({ data: { result: '' } }),
        }),
      }),
      getTemplateSrv: () => ({
        replace: jest.fn().mockImplementation((query) => query),
      }),
      reportInteraction: jest.fn(),
    };
  },
  { virtual: true }
);

jest.mock('../dataProcessor', () => ({
  __esModule: true,
  default: {
    metricFunctions: {},
  },
}));

jest.mock('../metricFunctions', () => ({
  getCategories: jest.fn(() => ({})),
  createFuncInstance: jest.fn(),
}));

jest.mock('../components/AnnotationQueryEditor', () => ({
  AnnotationQueryEditor: () => {},
}));

jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  replaceVariablesInFuncParams: jest.fn(),
  parseInterval: jest.fn(),
  replaceTemplateVars: jest.fn().mockImplementation((_templateSrv, prop) => prop),
  getRangeScopedVars: jest.fn(),
  bindFunctionDefs: jest.fn().mockResolvedValue([]),
  parseLegacyVariableQuery: jest.fn(),
  formatMetric: jest.fn().mockImplementation((metric) => ({
    text: metric.name,
    expandable: false,
  })),
}));

describe('ZabbixDatasource', () => {
  let ctx: any = {};
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    ctx.instanceSettings = {
      jsonData: {
        alerting: false,
        username: 'zabbix',
        password: 'zabbix',
        trends: true,
        trendsFrom: '14d',
        trendsRange: '7d',
        dbConnectionEnable: false,
      },
    };

    ctx.options = {
      targets: [
        {
          group: { filter: '' },
          host: { filter: '' },
          application: { filter: '' },
          item: { filter: '' },
        },
      ],
      range: {
        from: dateMath.toDateTime('now-1h', {}),
        to: dateMath.toDateTime('now', {}),
      },
    };

    ctx.datasourceSrv = datasourceSrvMock;

    ctx.ds = new ZabbixDatasource(ctx.instanceSettings);
    ctx.ds.templateSrv = templateSrvMock;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('When querying text data', () => {
    beforeEach(() => {
      ctx.ds.replaceTemplateVars = (str) => str;
      ctx.ds.zabbix.zabbixAPI.getHistory = jest.fn().mockReturnValue(
        Promise.resolve([
          { clock: '1500010200', itemid: '10100', ns: '900111000', value: 'Linux first' },
          { clock: '1500010300', itemid: '10100', ns: '900111000', value: 'Linux 2nd' },
          { clock: '1500010400', itemid: '10100', ns: '900111000', value: 'Linux last' },
        ])
      );

      ctx.ds.zabbix.getItemsFromTarget = jest.fn().mockReturnValue(
        Promise.resolve([
          {
            hosts: [{ hostid: '10001', name: 'Zabbix server' }],
            itemid: '10100',
            name: 'System information',
            key_: 'system.uname',
          },
        ])
      );

      ctx.options.targets = [
        {
          group: { filter: '' },
          host: { filter: 'Zabbix server' },
          application: { filter: '' },
          item: { filter: 'System information' },
          textFilter: '',
          useCaptureGroups: true,
          queryType: '2',
          resultFormat: 'table',
          options: {
            skipEmptyValues: false,
          },
        },
      ];
    });

    it('should return data in table format', async () => {
      const result = (await ctx.ds.frontendQuery(ctx.options)) as DataQueryResponse;
      expect(result.data.length).toBe(1);

      const tableData = result.data[0];
      expect(tableData.fields.map((f) => f.name)).toEqual(['Host', 'Item', 'Key', 'Last value']);
      expect(tableData.fields.map((f) => f.values[0])).toEqual([
        'Zabbix server',
        'System information',
        'system.uname',
        'Linux last',
      ]);
    });

    it('should extract value if regex with capture group is used', (done) => {
      ctx.options.targets[0].textFilter = 'Linux (.*)';
      ctx.ds.frontendQuery(ctx.options).then((result) => {
        const tableData = result.data[0];
        expect(tableData.fields.find((f) => f.name === 'Last value')?.values[0]).toEqual('last');
        done();
      });
    });

    it('should skip item when last value is empty', () => {
      ctx.ds.zabbix.getItemsFromTarget = jest.fn().mockReturnValue(
        Promise.resolve([
          {
            hosts: [{ hostid: '10001', name: 'Zabbix server' }],
            itemid: '10100',
            name: 'System information',
            key_: 'system.uname',
          },
          {
            hosts: [{ hostid: '10002', name: 'Server02' }],
            itemid: '90109',
            name: 'System information',
            key_: 'system.uname',
          },
        ])
      );

      ctx.options.targets[0].options.skipEmptyValues = true;
      ctx.ds.zabbix.getHistory = jest.fn().mockReturnValue(
        Promise.resolve([
          { clock: '1500010200', itemid: '10100', ns: '900111000', value: 'Linux first' },
          { clock: '1500010300', itemid: '10100', ns: '900111000', value: 'Linux 2nd' },
          { clock: '1500010400', itemid: '10100', ns: '900111000', value: 'Linux last' },
          { clock: '1500010200', itemid: '90109', ns: '900111000', value: 'Non empty value' },
          { clock: '1500010500', itemid: '90109', ns: '900111000', value: '' },
        ])
      );
      return ctx.ds.frontendQuery(ctx.options).then((result) => {
        const tableData = result.data[0];
        expect(tableData.length).toBe(1);
        expect(tableData.fields.find((f) => f.name === 'Last value')?.values[0]).toEqual('Linux last');
      });
    });
  });

  describe('When querying numeric data', () => {
    it('passes target with hostTags and evaltype to getItemsFromTarget', async () => {
      const hostTags = [{ tag: 'product', value: 'A', operator: '1' as any }];
      const target = {
        group: { filter: 'Servers' },
        host: { filter: '.*' },
        application: { filter: '' },
        itemTag: { filter: '' },
        item: { filter: 'CPU' },
        hostTags,
        evaltype: '0' as any,
        options: { showDisabledItems: false },
        functions: [],
      };

      ctx.ds.zabbix.getItemsFromTarget = jest.fn().mockResolvedValue([]);
      ctx.ds.queryNumericDataForItems = jest.fn().mockResolvedValue([]);
      ctx.ds.handleBackendPostProcessingResponse = jest.fn().mockResolvedValue([]);

      await ctx.ds.queryNumericData(target, [100, 200], false, {});

      expect(ctx.ds.zabbix.getItemsFromTarget).toHaveBeenCalledWith(target, {
        itemtype: 'num',
        showDisabledItems: false,
      });
    });
  });

  describe('When querying problems', () => {
    const buildProblemsTarget = (options: any = {}, showProblems = 'problems') => ({
      group: { filter: '' },
      host: { filter: '' },
      application: { filter: '' },
      proxy: { filter: '' },
      trigger: { filter: '' },
      tags: { filter: '' },
      showProblems,
      options,
    });

    beforeEach(() => {
      ctx.ds.replaceTemplateVars = (str) => str;
      ctx.ds.zabbix.getProblems = jest.fn().mockResolvedValue([]);
      ctx.ds.zabbix.getProblemsHistory = jest.fn().mockResolvedValue([]);
      ctx.ds.zabbix.getUsers = jest.fn().mockResolvedValue([]);
    });

    it.each([true, false])('passes symptom=%s to getProblems when the option is set', async (symptom) => {
      const target = buildProblemsTarget({ symptom });

      await ctx.ds.queryProblems(target, [100, 200], {});

      expect(ctx.ds.zabbix.getProblems).toHaveBeenCalledWith('', '', '', '', expect.objectContaining({ symptom }));
    });

    it.each([undefined, null])('omits symptom from problems options when it is %s', async (symptom) => {
      const target = buildProblemsTarget({ symptom });

      await ctx.ds.queryProblems(target, [100, 200], {});

      const [, , , , problemsOptions] = ctx.ds.zabbix.getProblems.mock.calls.at(-1);
      expect('symptom' in problemsOptions).toBe(false);
    });

    it('passes symptom to getProblemsHistory when querying history', async () => {
      const target = buildProblemsTarget({ symptom: true }, 'history');

      await ctx.ds.queryProblems(target, [100, 200], {});

      expect(ctx.ds.zabbix.getProblemsHistory).toHaveBeenCalledWith(
        '',
        '',
        '',
        '',
        expect.objectContaining({ symptom: true, timeFrom: 100, timeTo: 200 })
      );
    });
  });

  describe('When querying dashboard annotations', () => {
    const problems = [
      {
        name: 'High CPU',
        value: '1',
        timestamp: '1700000000',
        hosts: [{ name: 'web-01' }],
        acknowledges: [{ message: 'on it', name: 'Admin', surname: '', clock: '1700000100' }],
      },
      { name: 'Low memory', value: '1', timestamp: '1700000200', hosts: [{ name: 'db-01' }], acknowledges: [] },
    ];

    const buildAnnotationTarget = (options: any = {}) => ({
      group: { filter: '' },
      host: { filter: '' },
      application: { filter: '' },
      trigger: { filter: '' },
      fromAnnotations: true,
      options: { minSeverity: 0, showOkEvents: false, hideAcknowledged: false, showHostname: false, ...options },
    });

    beforeEach(() => {
      ctx.ds.zabbix.getProblemsHistory = jest.fn().mockResolvedValue(problems);
    });

    it('keeps acknowledged events and omits hostnames by default', async () => {
      const events = await ctx.ds.annotationQueryLegacy({ ...ctx.options, targets: [buildAnnotationTarget()] });

      expect(events.map((e: any) => e.text.split('<br>')[0])).toEqual(['High CPU', 'Low memory']);
      expect(events.every((e: any) => e.tags.length === 0)).toBe(true);
    });

    it('hides acknowledged events when options.hideAcknowledged is set', async () => {
      const target = buildAnnotationTarget({ hideAcknowledged: true });

      const events = await ctx.ds.annotationQueryLegacy({ ...ctx.options, targets: [target] });

      expect(events).toHaveLength(1);
      expect(events[0].text).toBe('Low memory');
    });

    it('tags events with hostnames when options.showHostname is set', async () => {
      const target = buildAnnotationTarget({ showHostname: true });

      const events = await ctx.ds.annotationQueryLegacy({ ...ctx.options, targets: [target] });

      expect(events.map((e: any) => e.tags)).toEqual([['web-01'], ['db-01']]);
    });
  });

  describe('When querying problem annotations for metric queries', () => {
    const metricsTarget = (problemAnnotations?: any, extra: any = {}) => ({
      refId: 'A',
      queryType: '0',
      group: { filter: 'Linux' },
      host: { filter: 'web-01' },
      application: { filter: '' },
      itemTag: { filter: '' },
      item: { filter: 'CPU utilization' },
      options: {},
      problemAnnotations,
      ...extra,
    });

    const triggerA = { triggerid: '10', description: 'High CPU', priority: '4', items: [{ itemid: '1' }] };
    const triggerB = { triggerid: '11', description: 'Low memory', priority: '2', items: [{ itemid: '2' }] };
    const ids = (res: any) => res.data[0].fields.find((f: any) => f.name === 'id').values;
    const itemIds = (entries: Array<[string, string[]]>) => new Map(entries.map(([ref, v]) => [ref, new Set(v)]));

    beforeEach(() => {
      ctx.ds.zabbix.getItemsFromTarget = jest.fn().mockResolvedValue([{ itemid: '1' }, { itemid: '2' }]);
      ctx.ds.zabbix.getItemTriggers = jest.fn().mockResolvedValue([triggerA, triggerB]);
      ctx.ds.zabbix.getTriggerEvents = jest.fn().mockResolvedValue([
        { eventid: '101', objectid: '10', clock: '1700000300', value: '0', name: 'High CPU', severity: '0' },
        {
          eventid: '200',
          objectid: '10',
          clock: '1700000900',
          value: '1',
          name: 'High CPU',
          severity: '4',
          r_eventid: '0',
          acknowledged: '1',
        },
        {
          eventid: '100',
          objectid: '10',
          clock: '1700000000',
          value: '1',
          name: 'High CPU',
          severity: '4',
          r_eventid: '101',
        },
        {
          eventid: '300',
          objectid: '11',
          clock: '1700000100',
          value: '1',
          name: 'Low memory',
          severity: '2',
          r_eventid: '0',
        },
      ]);
    });

    it('does nothing for queries saved without the setting', async () => {
      const res = await ctx.ds.queryProblemAnnotations({ ...ctx.options, targets: [metricsTarget()] });

      expect(res.data).toEqual([]);
      expect(ctx.ds.zabbix.getItemsFromTarget).not.toHaveBeenCalled();
      expect(ctx.ds.zabbix.getItemTriggers).not.toHaveBeenCalled();
      expect(ctx.ds.zabbix.getTriggerEvents).not.toHaveBeenCalled();
    });

    it('uses the item ids of the returned series without resolving the query again', async () => {
      const target = metricsTarget({ enabled: true });

      await ctx.ds.queryProblemAnnotations({ ...ctx.options, targets: [target] }, itemIds([['A', ['2']]]));

      expect(ctx.ds.zabbix.getItemsFromTarget).not.toHaveBeenCalled();
      expect(ctx.ds.zabbix.getItemTriggers).toHaveBeenCalledWith(['2']);
      // Only the trigger of item 2
      expect(ctx.ds.zabbix.getTriggerEvents.mock.calls[0][0]).toEqual(['11']);
    });

    it('resolves the query only when its series carry no item ids', async () => {
      const target = metricsTarget({ enabled: true });

      await ctx.ds.queryProblemAnnotations({ ...ctx.options, targets: [target] }, itemIds([['B', ['9']]]));

      expect(ctx.ds.zabbix.getItemsFromTarget).toHaveBeenCalledTimes(1);
      expect(ctx.ds.zabbix.getItemTriggers).toHaveBeenCalledWith(['1', '2']);
    });

    it('annotates with problems, ending each region at its recovery from the same events call', async () => {
      const target = metricsTarget({ enabled: true });

      const res = await ctx.ds.queryProblemAnnotations({ ...ctx.options, targets: [target] });

      expect(ctx.ds.zabbix.getTriggerEvents).toHaveBeenCalledTimes(1);
      const [triggerids, , , limit] = ctx.ds.zabbix.getTriggerEvents.mock.calls[0];
      expect(triggerids).toEqual(['10', '11']);
      expect(limit).toBe(2000);
      expect(res.data).toHaveLength(1);
      expect(res.data[0].meta.dataTopic).toBe('annotations');
      expect(ids(res)).toEqual(['200', '100', '300']);
      const timeEnd = res.data[0].fields.find((f: any) => f.name === 'timeEnd').values;
      expect(timeEnd[1]).toBe(1700000300000);
    });

    it('makes one trigger and one events call for a panel with several queries', async () => {
      const targets = [
        metricsTarget({ enabled: true, minSeverity: 4 }),
        metricsTarget({ enabled: true, triggerFilter: '/memory/' }, { refId: 'B' }),
      ];

      const res = await ctx.ds.queryProblemAnnotations(
        { ...ctx.options, targets },
        itemIds([
          ['A', ['1']],
          ['B', ['2']],
        ])
      );

      expect(ctx.ds.zabbix.getItemTriggers).toHaveBeenCalledTimes(1);
      expect(ctx.ds.zabbix.getItemTriggers).toHaveBeenCalledWith(['1', '2']);
      expect(ctx.ds.zabbix.getTriggerEvents).toHaveBeenCalledTimes(1);
      expect(ctx.ds.zabbix.getTriggerEvents.mock.calls[0][0]).toEqual(['10', '11']);
      // A: CPU problems at High or above; B: memory problems of any severity
      expect(ids(res)).toEqual(['200', '100', '300']);
    });

    it("applies each query's own filters", async () => {
      const targets = [
        metricsTarget({ enabled: true, hideAcknowledged: true }),
        metricsTarget({ enabled: true, minSeverity: 3 }, { refId: 'B' }),
      ];

      const res = await ctx.ds.queryProblemAnnotations(
        { ...ctx.options, targets },
        itemIds([
          ['A', ['1']],
          ['B', ['2']],
        ])
      );

      // A hides acknowledged 200; B's Warning 300 is below Average
      expect(ids(res)).toEqual(['100']);
    });

    it('skips the events call when the trigger filter matches nothing', async () => {
      const target = metricsTarget({ enabled: true, triggerFilter: 'No such trigger' });

      const res = await ctx.ds.queryProblemAnnotations({ ...ctx.options, targets: [target] });

      expect(ctx.ds.zabbix.getTriggerEvents).not.toHaveBeenCalled();
      expect(res.data).toEqual([]);
    });

    it('uses item ids directly for Item ID queries', async () => {
      const target = metricsTarget({ enabled: true }, { queryType: '3', itemids: '5, 6' });

      await ctx.ds.queryProblemAnnotations({ ...ctx.options, targets: [target] });

      expect(ctx.ds.zabbix.getItemsFromTarget).not.toHaveBeenCalled();
      expect(ctx.ds.zabbix.getItemTriggers).toHaveBeenCalledWith(['5', '6']);
    });

    it('turns on for every metric query when the data source default is on', async () => {
      ctx.ds.problemAnnotationsByDefault = true;

      const res = await ctx.ds.queryProblemAnnotations({
        ...ctx.options,
        targets: [metricsTarget(), metricsTarget({ enabled: false }, { refId: 'B', item: { filter: 'Memory' } })],
      });

      expect(ctx.ds.zabbix.getItemsFromTarget).toHaveBeenCalledTimes(1);
      expect(res.data).toHaveLength(1);
    });

    it('returns no annotations instead of failing the panel when the API errors', async () => {
      ctx.ds.zabbix.getItemTriggers = jest.fn().mockRejectedValue(new Error('boom'));
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const res = await ctx.ds.queryProblemAnnotations({ ...ctx.options, targets: [metricsTarget({ enabled: true })] });

      expect(res.data).toEqual([]);
      warn.mockRestore();
    });
  });

  describe('When resolving items by tag regex', () => {
    it('returns no items without making an unfiltered request when no tags match', async () => {
      ctx.ds.zabbix.getHosts = jest.fn().mockResolvedValue([{ hostid: '10001' }]);
      ctx.ds.zabbix.getItemTags = jest.fn().mockResolvedValue([]);
      ctx.ds.zabbix.zabbixAPI.getItems = jest.fn();

      const result = await ctx.ds.zabbix.getAllItems('GroupFilter', 'HostFilter', 'AppFilter', '/^NonExistentTag/', {
        itemtype: 'num',
      });

      expect(result).toEqual([]);
      expect(ctx.ds.zabbix.getItemTags).toHaveBeenCalledWith(
        'GroupFilter',
        'HostFilter',
        '/^NonExistentTag/',
        undefined,
        undefined
      );
      expect(ctx.ds.zabbix.zabbixAPI.getItems).not.toHaveBeenCalled();
    });
  });

  describe('When invoking metricFindQuery() with legacy query', () => {
    beforeEach(() => {
      ctx.ds.zabbix = {
        getGroups: jest.fn().mockReturnValue(Promise.resolve([])),
        getHosts: jest.fn().mockReturnValue(Promise.resolve([])),
        getApps: jest.fn().mockReturnValue(Promise.resolve([])),
        getItems: jest.fn().mockReturnValue(Promise.resolve([])),
      };
    });

    it('should return groups', (done) => {
      jest.spyOn(utils, 'parseLegacyVariableQuery').mockImplementation((query: string) => {
        let group = '';
        if (query === '*') {
          group = '/.*/';
        } else {
          group = query;
        }
        return {
          queryType: VariableQueryTypes.Group,
          group: group,
        };
      });

      const tests = [
        { query: '*', expect: '/.*/' },
        { query: 'Backend', expect: 'Backend' },
        { query: 'Back*', expect: 'Back*' },
      ];

      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(ctx.ds.zabbix.getGroups).toHaveBeenCalledWith(test.expect);
        ctx.ds.zabbix.getGroups.mockClear();
      }
      done();
    });

    it('should return empty list for empty query', (done) => {
      ctx.ds.metricFindQuery('').then((result) => {
        expect(ctx.ds.zabbix.getGroups).toHaveBeenCalledTimes(0);
        ctx.ds.zabbix.getGroups.mockClear();

        expect(result).toEqual([]);
        done();
      });
    });

    it('should return hosts', (done) => {
      jest.spyOn(utils, 'parseLegacyVariableQuery').mockImplementation((query: string) => {
        let splits = query.split('.');
        return {
          queryType: VariableQueryTypes.Host,
          group: splits[0] === '*' ? '/.*/' : splits[0],
          host: splits[1] === '*' ? '/.*/' : splits[1],
        };
      });
      const tests = [
        { query: '*.*', expect: ['/.*/', '/.*/'] },
        { query: '.', expect: ['', ''] },
        { query: 'Backend.*', expect: ['Backend', '/.*/'] },
        { query: 'Back*.', expect: ['Back*', ''] },
      ];

      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(test.expect[0], test.expect[1], undefined, undefined);
        ctx.ds.zabbix.getHosts.mockClear();
      }
      done();
    });

    it('should return applications', (done) => {
      jest.spyOn(utils, 'parseLegacyVariableQuery').mockImplementation((query: string) => {
        let splits = query.split('.');
        return {
          queryType: VariableQueryTypes.Application,
          group: splits[0] === '*' ? '/.*/' : splits[0],
          host: splits[1] === '*' ? '/.*/' : splits[1],
          application: splits[2] === '*' ? '/.*/' : splits[2],
        };
      });
      const tests = [
        { query: '*.*.*', expect: ['/.*/', '/.*/', '/.*/'] },
        { query: '.*.', expect: ['', '/.*/', ''] },
        { query: 'Backend.backend01.*', expect: ['Backend', 'backend01', '/.*/'] },
        { query: 'Back*.*.', expect: ['Back*', '/.*/', ''] },
      ];

      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(ctx.ds.zabbix.getApps).toHaveBeenCalledWith(
          test.expect[0],
          test.expect[1],
          test.expect[2],
          undefined,
          undefined
        );
        ctx.ds.zabbix.getApps.mockClear();
      }
      done();
    });

    it('should return items', (done) => {
      jest.spyOn(utils, 'parseLegacyVariableQuery').mockImplementation((query: string) => {
        let splits = query.split('.');
        return {
          queryType: VariableQueryTypes.Item,
          group: splits[0] === '*' ? '/.*/' : splits[0],
          host: splits[1] === '*' ? '/.*/' : splits[1],
          application: splits[2] === '*' ? '' : splits[2],
          item: splits[3] === '*' ? '/.*/' : splits[3],
        };
      });
      const tests = [
        {
          query: '*.*.*.*',
          expect: [
            '/.*/',
            '/.*/',
            '',
            undefined,
            '/.*/',
            { showDisabledItems: undefined, pushDownItemFilter: true, selectTags: false },
          ],
        },
        {
          query: '.*.*.*',
          expect: [
            '',
            '/.*/',
            '',
            undefined,
            '/.*/',
            { showDisabledItems: undefined, pushDownItemFilter: true, selectTags: false },
          ],
        },
        {
          query: 'Backend.backend01.*.*',
          expect: [
            'Backend',
            'backend01',
            '',
            undefined,
            '/.*/',
            { showDisabledItems: undefined, pushDownItemFilter: true, selectTags: false },
          ],
        },
        {
          query: 'Back*.*.cpu.*',
          expect: [
            'Back*',
            '/.*/',
            'cpu',
            undefined,
            '/.*/',
            { showDisabledItems: undefined, pushDownItemFilter: true, selectTags: false },
          ],
        },
      ];

      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(ctx.ds.zabbix.getItems).toHaveBeenCalledWith(
          test.expect[0],
          test.expect[1],
          test.expect[2],
          test.expect[3],
          test.expect[4],
          test.expect[5]
        );
        ctx.ds.zabbix.getItems.mockClear();
      }
      done();
    });

    it('should invoke method with proper arguments', (done) => {
      jest.spyOn(utils, 'parseLegacyVariableQuery').mockImplementation((query: string) => {
        let splits = query.split('.');
        return {
          queryType: VariableQueryTypes.Host,
          group: splits[0] === '*' ? '/.*/' : splits[0],
          host: splits[1] === '*' ? '/.*/' : splits[1],
        };
      });
      let query = '*.*';

      ctx.ds.metricFindQuery(query);
      expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith('/.*/', '/.*/', undefined, undefined);
      done();
    });

    describe('When invoking metricFindQuery()', () => {
      beforeEach(() => {
        ctx.ds.zabbix = {
          getGroups: jest.fn().mockReturnValue(Promise.resolve([{ name: 'Group1' }, { name: 'Group2' }])),
          getHosts: jest.fn().mockReturnValue(Promise.resolve([{ name: 'Host1' }, { name: 'Host2' }])),
          getApps: jest.fn().mockReturnValue(Promise.resolve([{ name: 'App1' }, { name: 'App2' }])),
          getItems: jest.fn().mockReturnValue(Promise.resolve([{ name: 'Item1' }, { name: 'Item2' }])),
          getItemTags: jest.fn().mockReturnValue(Promise.resolve([{ name: 'Tag1' }, { name: 'Tag2' }])),
          getItemValues: jest.fn().mockReturnValue(Promise.resolve([{ name: 'Value1' }, { name: 'Value2' }])),
        };
      });

      it('should return groups when queryType is Group', async () => {
        const query = { queryType: VariableQueryTypes.Group, group: 'GroupFilter' };
        const result = await ctx.ds.metricFindQuery(query, {});
        expect(ctx.ds.zabbix.getGroups).toHaveBeenCalledWith('GroupFilter');
        expect(result).toEqual([
          { text: 'Group1', expandable: false },
          { text: 'Group2', expandable: false },
        ]);
      });

      it('should return hosts when queryType is Host', async () => {
        const query = { queryType: VariableQueryTypes.Host, group: 'GroupFilter', host: 'HostFilter' };
        const result = await ctx.ds.metricFindQuery(query, {});
        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith('GroupFilter', 'HostFilter', undefined, undefined);
        expect(result).toEqual([
          { text: 'Host1', expandable: false },
          { text: 'Host2', expandable: false },
        ]);
      });

      it('should pass hostTags and evaltype when queryType is Host', async () => {
        const hostTags = [{ tag: 'class', value: 'database', operator: '1' as any }];
        const query = {
          queryType: VariableQueryTypes.Host,
          group: 'GroupFilter',
          host: '/.*/',
          hostTags,
          evaltype: '2' as any,
        };
        await ctx.ds.metricFindQuery(query, {});
        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(
          'GroupFilter',
          '/.*/',
          [{ tag: 'class', value: 'database', operator: '1' }],
          '2'
        );
      });

      it('should pass hostTags and evaltype for non-Host query types', async () => {
        const hostTags = [{ tag: 'class', value: 'database', operator: '1' as any }];

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Application,
            group: 'GroupFilter',
            host: 'HostFilter',
            application: 'AppFilter',
            hostTags,
            evaltype: '2' as any,
          },
          {}
        );
        expect(ctx.ds.zabbix.getApps).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          'AppFilter',
          [{ tag: 'class', value: 'database', operator: '1' }],
          '2'
        );

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.ItemTag,
            group: 'GroupFilter',
            host: 'HostFilter',
            itemTag: 'TagFilter',
            hostTags,
            evaltype: '2' as any,
          },
          {}
        );
        expect(ctx.ds.zabbix.getItemTags).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          'TagFilter',
          [{ tag: 'class', value: 'database', operator: '1' }],
          '2'
        );

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Item,
            group: 'GroupFilter',
            host: 'HostFilter',
            application: 'AppFilter',
            itemTag: 'TagFilter',
            item: 'ItemFilter',
            hostTags,
            evaltype: '2' as any,
          },
          {}
        );
        expect(ctx.ds.zabbix.getItems).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          'AppFilter',
          'TagFilter',
          'ItemFilter',
          expect.objectContaining({
            hostTags: [{ tag: 'class', value: 'database', operator: '1' }],
            evaltype: '2',
          })
        );
      });

      it('should default an empty host filter to /.*/ when host tags are set', async () => {
        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Item,
            group: 'GroupFilter',
            host: '',
            item: 'ItemFilter',
            hostTags: [{ tag: 'class', value: 'database', operator: '1' as any }],
          },
          {}
        );
        expect(ctx.ds.zabbix.getItems).toHaveBeenCalledWith(
          'GroupFilter',
          '/.*/',
          undefined,
          undefined,
          'ItemFilter',
          expect.objectContaining({ hostTags: [{ tag: 'class', value: 'database', operator: '1' }] })
        );
      });

      it('should interpolate host tags literally, without regex anchoring', async () => {
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string) => {
          return str === '$env' ? 'production' : str;
        });

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: 'HostFilter',
            hostTags: [{ tag: 'env', value: '$env', operator: '1' as any }],
          },
          {}
        );

        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          [{ tag: 'env', value: 'production', operator: '1' }],
          undefined
        );
      });

      it('should expand a multi-value variable in a host tag value into one filter per value', async () => {
        const scopedVars = { __sceneObject: { value: 'scene' } };
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, scoped: any, format?: Function) => {
          if (str !== '$cls') {
            return str;
          }
          return format ? format(['Database', 'web'], { name: 'cls' }) : '{Database,web}';
        });

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: 'HostFilter',
            hostTags: [{ tag: '$tagName', value: '$cls', operator: '1' as any }],
          },
          { scopedVars }
        );

        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          [
            { tag: '$tagName', value: 'Database', operator: '1' },
            { tag: '$tagName', value: 'web', operator: '1' },
          ],
          undefined
        );
        // Both the tag name and the value are interpolated with the query's scoped variables.
        expect(ctx.ds.templateSrv.replace).toHaveBeenCalledWith('$tagName', scopedVars);
        expect(ctx.ds.templateSrv.replace).toHaveBeenCalledWith('$cls', scopedVars, expect.any(Function));
      });

      it('should return nothing when a positive host tag filter expands to no values', async () => {
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, _scoped: any, format?: Function) => {
          return str === '$cls' && format ? format([], { name: 'cls' }) : str;
        });

        const result = await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: '',
            hostTags: [{ tag: 'class', value: '$cls', operator: '1' as any }],
          },
          {}
        );

        expect(result).toEqual([]);
        expect(ctx.ds.zabbix.getHosts).not.toHaveBeenCalled();
      });

      it('should drop a negated host tag filter that expands to no values', async () => {
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, _scoped: any, format?: Function) => {
          return str === '$cls' && format ? format([], { name: 'cls' }) : str;
        });

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: 'HostFilter',
            hostTags: [
              { tag: 'class', value: '$cls', operator: '3' as any },
              { tag: 'env', value: 'prod', operator: '1' as any },
            ],
          },
          {}
        );

        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          [{ tag: 'env', value: 'prod', operator: '1' }],
          undefined
        );
      });

      it('should still match every host when the only configured filter is a negated no-op', async () => {
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, _scoped: any, format?: Function) => {
          return str === '$excluded' && format ? format([], { name: 'excluded' }) : str;
        });

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: '',
            hostTags: [{ tag: 'class', value: '$excluded', operator: '3' as any }],
          },
          {}
        );

        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith('GroupFilter', '/.*/', [], undefined);
      });

      it('should keep an Or query when only one of the host tag filters expands to no values', async () => {
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, _scoped: any, format?: Function) => {
          return str === '$cls' && format ? format([], { name: 'cls' }) : str;
        });

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: 'HostFilter',
            evaltype: '2' as any,
            hostTags: [
              { tag: 'class', value: '$cls', operator: '1' as any },
              { tag: 'env', value: 'prod', operator: '1' as any },
            ],
          },
          {}
        );

        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          [{ tag: 'env', value: 'prod', operator: '1' }],
          '2'
        );
      });

      it('should not expand the value of Exists / Does not exist host tag filters', async () => {
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, _scoped: any, format?: Function) => {
          return str === '$cls' && format ? format(['Database', 'web'], { name: 'cls' }) : str;
        });

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: 'HostFilter',
            hostTags: [
              { tag: 'class', value: '$cls', operator: '4' as any },
              { tag: 'legacy', value: '$cls', operator: '5' as any },
            ],
          },
          {}
        );

        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          [
            { tag: 'class', value: '', operator: '4' },
            { tag: 'legacy', value: '', operator: '5' },
          ],
          undefined
        );
      });

      it('should keep an And/Or query when another filter on the same tag can still match', async () => {
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, _scoped: any, format?: Function) => {
          return str === '$cls' && format ? format([], { name: 'cls' }) : str;
        });

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: 'HostFilter',
            hostTags: [
              { tag: 'class', value: '$cls', operator: '1' as any },
              { tag: 'class', value: 'web', operator: '1' as any },
            ],
          },
          {}
        );

        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          [{ tag: 'class', value: 'web', operator: '1' }],
          undefined
        );
      });

      it('should return nothing when an And/Or filter on another tag expands to no values', async () => {
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, _scoped: any, format?: Function) => {
          return str === '$cls' && format ? format([], { name: 'cls' }) : str;
        });

        const result = await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: 'HostFilter',
            hostTags: [
              { tag: 'class', value: '$cls', operator: '1' as any },
              { tag: 'env', value: 'prod', operator: '1' as any },
            ],
          },
          {}
        );

        expect(result).toEqual([]);
        expect(ctx.ds.zabbix.getHosts).not.toHaveBeenCalled();
      });

      it('should ignore host tag filters whose tag name interpolates to an empty string', async () => {
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string) => (str === '$tagName' ? '' : str));

        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: '',
            hostTags: [{ tag: '$tagName', value: 'database', operator: '1' as any }],
          },
          {}
        );

        // No usable filter remains, so the empty Host filter must not be coerced to /.*/.
        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith('GroupFilter', '', [], undefined);
      });

      describe('with All selected on a referenced variable', () => {
        beforeEach(() => {
          ctx.ds.templateSrv.getVariables = jest
            .fn()
            .mockReturnValue([{ name: 'cls', current: { value: ['$__all'] }, allValue: '.*' }]);
          // Grafana substitutes a custom all value without invoking the formatter.
          ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string) => str.replace('$cls', '.*'));
        });

        afterEach(() => {
          delete ctx.ds.templateSrv.getVariables;
        });

        it('should treat the filter as no constraint instead of sending the all value literally', async () => {
          await ctx.ds.metricFindQuery(
            {
              queryType: VariableQueryTypes.Host,
              group: 'GroupFilter',
              host: '',
              hostTags: [{ tag: 'class', value: '$cls', operator: '1' as any }],
            },
            {}
          );

          // The filter is dropped, and an empty Host still widens to every host.
          expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith('GroupFilter', '/.*/', [], undefined);
        });

        it('should keep the other filters', async () => {
          await ctx.ds.metricFindQuery(
            {
              queryType: VariableQueryTypes.Host,
              group: 'GroupFilter',
              host: 'HostFilter',
              hostTags: [
                { tag: 'class', value: '$cls', operator: '1' as any },
                { tag: 'env', value: 'prod', operator: '1' as any },
              ],
            },
            {}
          );

          expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(
            'GroupFilter',
            'HostFilter',
            [{ tag: 'env', value: 'prod', operator: '1' }],
            undefined
          );
        });

        it('should drop a filter whose tag name has All selected', async () => {
          await ctx.ds.metricFindQuery(
            {
              queryType: VariableQueryTypes.Host,
              group: 'GroupFilter',
              host: 'HostFilter',
              hostTags: [{ tag: '$cls', value: 'database', operator: '1' as any }],
            },
            {}
          );

          expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith('GroupFilter', 'HostFilter', [], undefined);
        });

        it('should still expand a scoped value that overrides All', async () => {
          const scopedVars = { cls: { value: 'cache' } };
          ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, scoped: any, format?: Function) => {
            if (str !== '$cls') {
              return str;
            }
            return format ? format(scoped?.cls?.value, { name: 'cls' }) : scoped?.cls?.value;
          });

          await ctx.ds.metricFindQuery(
            {
              queryType: VariableQueryTypes.Host,
              group: 'GroupFilter',
              host: 'HostFilter',
              hostTags: [{ tag: 'class', value: '$cls', operator: '1' as any }],
            },
            { scopedVars }
          );

          expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(
            'GroupFilter',
            'HostFilter',
            [{ tag: 'class', value: 'cache', operator: '1' }],
            undefined
          );
        });
      });

      it('should ignore host tags on a Group query even when they cannot match', async () => {
        // A variable switched from Host to Group keeps its now-hidden host tags.
        ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, _scoped: any, format?: Function) => {
          if (str === '$cls' && format) {
            return format([], { name: 'cls' });
          }
          return str;
        });

        const result = await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Group,
            group: 'GroupFilter',
            hostTags: [{ tag: 'class', value: '$cls', operator: '1' as any }],
          },
          {}
        );

        expect(ctx.ds.zabbix.getGroups).toHaveBeenCalledWith('GroupFilter');
        expect(result).toEqual([
          { text: 'Group1', expandable: false },
          { text: 'Group2', expandable: false },
        ]);
      });

      it('should ignore host tag filters with an empty tag name', async () => {
        await ctx.ds.metricFindQuery(
          {
            queryType: VariableQueryTypes.Host,
            group: 'GroupFilter',
            host: 'HostFilter',
            hostTags: [{ tag: '', value: 'ignored', operator: '1' as any }],
          },
          {}
        );

        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith('GroupFilter', 'HostFilter', [], undefined);
      });

      it('should return applications when queryType is Application', async () => {
        const query = {
          queryType: VariableQueryTypes.Application,
          group: 'GroupFilter',
          host: 'HostFilter',
          application: 'AppFilter',
        };
        const result = await ctx.ds.metricFindQuery(query, {});
        expect(ctx.ds.zabbix.getApps).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          'AppFilter',
          undefined,
          undefined
        );
        expect(result).toEqual([
          { text: 'App1', expandable: false },
          { text: 'App2', expandable: false },
        ]);
      });

      it('should return items when queryType is Item', async () => {
        const query = {
          queryType: VariableQueryTypes.Item,
          group: 'GroupFilter',
          host: 'HostFilter',
          application: 'AppFilter',
          itemTag: 'TagFilter',
          item: 'ItemFilter',
        };
        const result = await ctx.ds.metricFindQuery(query, {});
        expect(ctx.ds.zabbix.getItems).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          'AppFilter',
          'TagFilter',
          'ItemFilter',
          { showDisabledItems: undefined, pushDownItemFilter: true, selectTags: false }
        );
        expect(result).toEqual([
          { text: 'Item1', expandable: false },
          { text: 'Item2', expandable: false },
        ]);
      });

      it('should return disabled items when queryType is Item and show disabled items is turned on', async () => {
        const query = {
          queryType: VariableQueryTypes.Item,
          group: 'GroupFilter',
          host: 'HostFilter',
          application: 'AppFilter',
          itemTag: 'TagFilter',
          item: 'ItemFilter',
          showDisabledItems: true,
        };
        const result = await ctx.ds.metricFindQuery(query, {});
        expect(ctx.ds.zabbix.getItems).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          'AppFilter',
          'TagFilter',
          'ItemFilter',
          { showDisabledItems: true, pushDownItemFilter: true, selectTags: false }
        );
        expect(result).toEqual([
          { text: 'Item1', expandable: false },
          { text: 'Item2', expandable: false },
        ]);
      });

      it('should return item tags when queryType is ItemTag', async () => {
        const query = {
          queryType: VariableQueryTypes.ItemTag,
          group: 'GroupFilter',
          host: 'HostFilter',
          itemTag: 'TagFilter',
        };
        const result = await ctx.ds.metricFindQuery(query, {});
        expect(ctx.ds.zabbix.getItemTags).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          'TagFilter',
          undefined,
          undefined
        );
        expect(result).toEqual([
          { text: 'Tag1', expandable: false },
          { text: 'Tag2', expandable: false },
        ]);
      });

      it('should return item values when queryType is ItemValues', async () => {
        const query = {
          queryType: VariableQueryTypes.ItemValues,
          group: 'GroupFilter',
          host: 'HostFilter',
          application: 'AppFilter',
          item: 'ItemFilter',
        };
        const options = { range: { from: 'now-1h', to: 'now' } };
        const result = await ctx.ds.metricFindQuery(query, options);
        expect(ctx.ds.zabbix.getItemValues).toHaveBeenCalledWith(
          'GroupFilter',
          'HostFilter',
          'AppFilter',
          'ItemFilter',
          {
            range: options.range,
            pushDownItemFilter: true,
            selectTags: false,
          }
        );
        expect(result).toEqual([
          { text: 'Value1', expandable: false },
          { text: 'Value2', expandable: false },
        ]);
      });

      it('should return an empty array for an unknown queryType', async () => {
        const query = { queryType: 'UnknownType' };
        const result = await ctx.ds.metricFindQuery(query, {});
        expect(result).toEqual([]);
      });

      it('should return an empty array for an empty query', async () => {
        const result = await ctx.ds.metricFindQuery('', {});
        expect(result).toEqual([]);
      });
    });
  });

  describe('When interpolating panel queries', () => {
    it('should interpolate host tag filters literally and expand multi-value variables', () => {
      ctx.ds.templateSrv.replace = jest.fn().mockImplementation((str: string, _scoped: any, format?: Function) => {
        if (str === '$cls') {
          return format ? format(['Database', 'web'], { name: 'cls' }) : '{Database,web}';
        }
        return str === '$tagName' ? 'class' : str;
      });

      const [result] = ctx.ds.interpolateVariablesInQueries(
        [
          {
            refId: 'A',
            hostTags: [{ tag: '$tagName', value: '$cls', operator: '1' as any }],
          } as any,
        ],
        {}
      );

      expect(result.hostTags).toEqual([
        { tag: 'class', value: 'Database', operator: '1' },
        { tag: 'class', value: 'web', operator: '1' },
      ]);
    });

    it('should leave queries without host tag filters untouched', () => {
      const [result] = ctx.ds.interpolateVariablesInQueries([{ refId: 'A' } as any], {});
      expect(result.hostTags).toBeUndefined();
    });

    it('should interpolate the problem annotations trigger filter like the item filter', () => {
      // utils.replaceTemplateVars is stubbed in this spec; make it resolve one variable
      (utils.replaceTemplateVars as jest.Mock).mockImplementation((_srv, prop) =>
        prop === '$trig' ? '/^High CPU$/' : prop
      );
      const problemAnnotations = { enabled: true, minSeverity: 2, triggerFilter: '$trig' };

      const [result] = ctx.ds.interpolateVariablesInQueries([{ refId: 'A', problemAnnotations } as any], {});

      expect(result.problemAnnotations).toEqual({ enabled: true, minSeverity: 2, triggerFilter: '/^High CPU$/' });
      // The saved query keeps the variable
      expect(problemAnnotations.triggerFilter).toBe('$trig');
      (utils.replaceTemplateVars as jest.Mock).mockImplementation((_srv, prop) => prop);
    });
  });
});
