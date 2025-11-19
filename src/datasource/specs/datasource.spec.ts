import { DataQueryResponse, dateMath } from '@grafana/data';
import _ from 'lodash';
import { datasourceSrvMock, templateSrvMock } from '../../test-setup/mocks';
import { VariableQueryTypes } from '../types';
import { ZabbixDatasource } from 'datasource/datasource';
// firstValueFrom removed - tests call frontendQuery directly for text queries
import * as utils from '../utils';

jest.mock(
  '@grafana/runtime',
  () => {
    const actual = jest.requireActual('@grafana/runtime');
    // Provide a custom query implementation that resolves backend + frontend + db + annotations
    // so tests relying on merged results receive expected data.
    if (actual && actual.DataSourceWithBackend && actual.DataSourceWithBackend.prototype) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      actual.DataSourceWithBackend.prototype.query = function (request: any) {
        const that: any = this;
        const { from } = require('rxjs');

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
      getDataSourceSrv: () => ({
        getInstanceSettings: jest.fn().mockResolvedValue({}),
      }),
      getTemplateSrv: () => ({
        replace: jest.fn().mockImplementation((query) => query),
      }),
      reportInteraction: jest.fn(),
    };
  },
  { virtual: true }
);

jest.mock('../components/AnnotationQueryEditor', () => ({
  AnnotationQueryEditor: () => {},
}));

jest.mock(
  '../utils',
  () => (
    jest.requireActual('../utils'),
    {
      replaceVariablesInFuncParams: jest.fn(),
      parseInterval: jest.fn(),
      replaceTemplateVars: jest.fn().mockImplementation((templateSrv, prop) => prop),
      getRangeScopedVars: jest.fn(),
      bindFunctionDefs: jest.fn().mockResolvedValue([]),
      parseLegacyVariableQuery: jest.fn(),
      formatMetric: jest.fn().mockImplementation((metric) => {
        return { text: metric.name, expandable: false };
      }),
    }
  )
);

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

      let tableData = result.data[0];
      expect(tableData.columns).toEqual([{ text: 'Host' }, { text: 'Item' }, { text: 'Key' }, { text: 'Last value' }]);
      expect(tableData.rows).toEqual([['Zabbix server', 'System information', 'system.uname', 'Linux last']]);
    });

    it('should extract value if regex with capture group is used', (done) => {
      ctx.options.targets[0].textFilter = 'Linux (.*)';
      ctx.ds.frontendQuery(ctx.options).then((result) => {
        let tableData = result.data[0];
        expect(tableData.rows[0][3]).toEqual('last');
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
        let tableData = result.data[0];
        expect(tableData.rows.length).toBe(1);
        expect(tableData.rows[0][3]).toEqual('Linux last');
      });
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

      jest.spyOn(utils, 'replaceTemplateVars').mockImplementation(({}, prop: string, {}) => {
        return prop;
      });
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
        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith(test.expect[0], test.expect[1]);
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
        expect(ctx.ds.zabbix.getApps).toHaveBeenCalledWith(test.expect[0], test.expect[1], test.expect[2]);
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
        { query: '*.*.*.*', expect: ['/.*/', '/.*/', '', undefined, '/.*/', { showDisabledItems: undefined }] },
        { query: '.*.*.*', expect: ['', '/.*/', '', undefined, '/.*/', { showDisabledItems: undefined }] },
        {
          query: 'Backend.backend01.*.*',
          expect: ['Backend', 'backend01', '', undefined, '/.*/', { showDisabledItems: undefined }],
        },
        {
          query: 'Back*.*.cpu.*',
          expect: ['Back*', '/.*/', 'cpu', undefined, '/.*/', { showDisabledItems: undefined }],
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
      expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith('/.*/', '/.*/');
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
        expect(ctx.ds.zabbix.getHosts).toHaveBeenCalledWith('GroupFilter', 'HostFilter');
        expect(result).toEqual([
          { text: 'Host1', expandable: false },
          { text: 'Host2', expandable: false },
        ]);
      });

      it('should return applications when queryType is Application', async () => {
        const query = {
          queryType: VariableQueryTypes.Application,
          group: 'GroupFilter',
          host: 'HostFilter',
          application: 'AppFilter',
        };
        const result = await ctx.ds.metricFindQuery(query, {});
        expect(ctx.ds.zabbix.getApps).toHaveBeenCalledWith('GroupFilter', 'HostFilter', 'AppFilter');
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
          { showDisabledItems: undefined }
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
          { showDisabledItems: true }
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
        expect(ctx.ds.zabbix.getItemTags).toHaveBeenCalledWith('GroupFilter', 'HostFilter', 'TagFilter');
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
});
