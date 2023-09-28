import _ from 'lodash';
import { templateSrvMock, datasourceSrvMock } from '../../test-setup/mocks';
import { replaceTemplateVars, ZabbixDatasource, zabbixTemplateFormat } from '../datasource';
import { dateMath } from '@grafana/data';

jest.mock(
  '@grafana/runtime',
  () => ({
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
  }),
  { virtual: true }
);

jest.mock('../components/AnnotationQueryEditor', () => ({
  AnnotationQueryEditor: () => {},
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
        from: dateMath.parse('now-1h'),
        to: dateMath.parse('now'),
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
          queryType: 2,
          resultFormat: 'table',
          options: {
            skipEmptyValues: false,
          },
        },
      ];
    });

    it('should return data in table format', (done) => {
      ctx.ds.query(ctx.options).then((result) => {
        expect(result.data.length).toBe(1);

        let tableData = result.data[0];
        expect(tableData.columns).toEqual([
          { text: 'Host' },
          { text: 'Item' },
          { text: 'Key' },
          { text: 'Last value' },
        ]);
        expect(tableData.rows).toEqual([['Zabbix server', 'System information', 'system.uname', 'Linux last']]);
        done();
      });
    });

    it('should extract value if regex with capture group is used', (done) => {
      ctx.options.targets[0].textFilter = 'Linux (.*)';
      ctx.ds.query(ctx.options).then((result) => {
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
      return ctx.ds.query(ctx.options).then((result) => {
        let tableData = result.data[0];
        expect(tableData.rows.length).toBe(1);
        expect(tableData.rows[0][3]).toEqual('Linux last');
      });
    });
  });

  describe('When replacing template variables', () => {
    function testReplacingVariable(target, varValue, expectedResult, done) {
      ctx.ds.replaceTemplateVars = _.partial(replaceTemplateVars, {
        replace: jest.fn((target) => zabbixTemplateFormat(varValue)),
      });

      let result = ctx.ds.replaceTemplateVars(target);
      expect(result).toBe(expectedResult);
      done();
    }

    /*
     * Alphanumerics, spaces, dots, dashes and underscores
     * are allowed in Zabbix host name.
     * 'AaBbCc0123 .-_'
     */
    it('should return properly escaped regex', (done) => {
      let target = '$host';
      let template_var_value = 'AaBbCc0123 .-_';
      let expected_result = '/^AaBbCc0123 \\.-_$/';

      testReplacingVariable(target, template_var_value, expected_result, done);
    });

    /*
     * Single-value variable
     * $host = backend01
     * $host => /^backend01|backend01$/
     */
    it('should return proper regex for single value', (done) => {
      let target = '$host';
      let template_var_value = 'backend01';
      let expected_result = '/^backend01$/';

      testReplacingVariable(target, template_var_value, expected_result, done);
    });

    /*
     * Multi-value variable
     * $host = [backend01, backend02]
     * $host => /^(backend01|backend01)$/
     */
    it('should return proper regex for multi-value', (done) => {
      let target = '$host';
      let template_var_value = ['backend01', 'backend02'];
      let expected_result = '/^(backend01|backend02)$/';

      testReplacingVariable(target, template_var_value, expected_result, done);
    });
  });

  describe('When invoking metricFindQuery() with legacy query', () => {
    beforeEach(() => {
      ctx.ds.replaceTemplateVars = (str) => str;
      ctx.ds.zabbix = {
        getGroups: jest.fn().mockReturnValue(Promise.resolve([])),
        getHosts: jest.fn().mockReturnValue(Promise.resolve([])),
        getApps: jest.fn().mockReturnValue(Promise.resolve([])),
        getItems: jest.fn().mockReturnValue(Promise.resolve([])),
      };
    });

    it('should return groups', (done) => {
      const tests = [
        { query: '*', expect: '/.*/' },
        { query: 'Backend', expect: 'Backend' },
        { query: 'Back*', expect: 'Back*' },
      ];

      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(ctx.ds.zabbix.getGroups).toBeCalledWith(test.expect);
        ctx.ds.zabbix.getGroups.mockClear();
      }
      done();
    });

    it('should return empty list for empty query', (done) => {
      ctx.ds.metricFindQuery('').then((result) => {
        expect(ctx.ds.zabbix.getGroups).toBeCalledTimes(0);
        ctx.ds.zabbix.getGroups.mockClear();

        expect(result).toEqual([]);
        done();
      });
    });

    it('should return hosts', (done) => {
      const tests = [
        { query: '*.*', expect: ['/.*/', '/.*/'] },
        { query: '.', expect: ['', ''] },
        { query: 'Backend.*', expect: ['Backend', '/.*/'] },
        { query: 'Back*.', expect: ['Back*', ''] },
      ];

      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(ctx.ds.zabbix.getHosts).toBeCalledWith(test.expect[0], test.expect[1]);
        ctx.ds.zabbix.getHosts.mockClear();
      }
      done();
    });

    it('should return applications', (done) => {
      const tests = [
        { query: '*.*.*', expect: ['/.*/', '/.*/', '/.*/'] },
        { query: '.*.', expect: ['', '/.*/', ''] },
        { query: 'Backend.backend01.*', expect: ['Backend', 'backend01', '/.*/'] },
        { query: 'Back*.*.', expect: ['Back*', '/.*/', ''] },
      ];

      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(ctx.ds.zabbix.getApps).toBeCalledWith(test.expect[0], test.expect[1], test.expect[2]);
        ctx.ds.zabbix.getApps.mockClear();
      }
      done();
    });

    it('should return items', (done) => {
      const tests = [
        { query: '*.*.*.*', expect: ['/.*/', '/.*/', '', null, '/.*/'] },
        { query: '.*.*.*', expect: ['', '/.*/', '', null, '/.*/'] },
        { query: 'Backend.backend01.*.*', expect: ['Backend', 'backend01', '', null, '/.*/'] },
        { query: 'Back*.*.cpu.*', expect: ['Back*', '/.*/', 'cpu', null, '/.*/'] },
      ];

      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(ctx.ds.zabbix.getItems).toBeCalledWith(
          test.expect[0],
          test.expect[1],
          test.expect[2],
          test.expect[3],
          test.expect[4]
        );
        ctx.ds.zabbix.getItems.mockClear();
      }
      done();
    });

    it('should invoke method with proper arguments', (done) => {
      let query = '*.*';

      ctx.ds.metricFindQuery(query);
      expect(ctx.ds.zabbix.getHosts).toBeCalledWith('/.*/', '/.*/');
      done();
    });
  });
});
