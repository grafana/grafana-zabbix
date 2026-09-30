import _ from 'lodash';
import { getDataSourceSrv } from '@grafana/runtime';
import { getUIDFromID, migrate, migrateDSConfig, DS_CONFIG_SCHEMA, DS_QUERY_SCHEMA } from './migrations';
import { problemTagsToQueryParam } from './utils';
import * as c from './constants';

// Mock getDataSourceSrv from @grafana/runtime
jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: jest.fn(),
}));

const mockedGetDataSourceSrv = getDataSourceSrv as jest.MockedFunction<typeof getDataSourceSrv>;

describe('Migrations', () => {
  let ctx: any = {};

  beforeEach(() => {
    mockedGetDataSourceSrv.mockReturnValue({
      getList: jest.fn().mockReturnValue([
        {
          id: 1,
          uid: 'datasource-1',
        },
      ]),
    } as any);
  });

  describe('When migrating datasource config', () => {
    beforeEach(() => {
      ctx.jsonData = {
        dbConnection: {
          enable: true,
          datasourceId: 1,
        },
      };
    });

    it('should change direct DB connection setting to flat style', () => {
      migrateDSConfig(ctx.jsonData);
      expect(ctx.jsonData).toMatchObject({
        dbConnectionEnable: true,
        dbConnectionDatasourceUID: 'datasource-1',
        schema: DS_CONFIG_SCHEMA,
      });
    });

    it('should migrate dbConnectionDatasourceId to dbConnectionDatasourceUID', () => {
      ctx.jsonData = {
        dbConnectionDatasourceId: 1,
        dbConnectionEnable: true,
        schema: 3,
      };
      migrateDSConfig(ctx.jsonData);
      expect(ctx.jsonData).toMatchObject({
        dbConnectionEnable: true,
        dbConnectionDatasourceUID: 'datasource-1',
        schema: DS_CONFIG_SCHEMA,
      });
    });

    it('should not touch anything if schema is up to date', () => {
      ctx.jsonData = {
        futureOptionOne: 'foo',
        futureOptionTwo: 'bar',
        schema: DS_CONFIG_SCHEMA,
      };
      migrateDSConfig(ctx.jsonData);
      expect(ctx.jsonData).toMatchObject({
        futureOptionOne: 'foo',
        futureOptionTwo: 'bar',
        schema: DS_CONFIG_SCHEMA,
      });
      expect(ctx.jsonData.dbConnectionEnable).toBeUndefined();
      expect(ctx.jsonData.dbConnectionDatasourceUID).toBeUndefined();
    });

    it('should upgrade schema when schema is missing (old config with no db connection)', () => {
      ctx.jsonData = {
        username: 'zabbix',
        trends: true,
        trendsFrom: '7d',
      };
      migrateDSConfig(ctx.jsonData);
      expect(ctx.jsonData.schema).toBe(DS_CONFIG_SCHEMA);
      expect(ctx.jsonData.username).toBe('zabbix');
    });

    it('should set schema to 4 when dbConnectionDatasourceId->UID migration fails (datasource not found) to avoid retry loop', () => {
      const getList = jest.fn().mockReturnValue([{ id: 99, uid: 'other-uid' }]);
      mockedGetDataSourceSrv.mockReturnValue({ getList } as any);
      ctx.jsonData = {
        dbConnectionDatasourceId: 999,
        dbConnectionEnable: true,
        schema: 3,
      };
      expect(() => migrateDSConfig(ctx.jsonData)).toThrow(
        `Error retrieving direct db connection data source. Data source with id 999 not found`
      );
    });

    it('should migrate timeout string to number when schema < 3 (including "0" and "")', () => {
      ctx.jsonData = { schema: 2, timeout: '30' };
      migrateDSConfig(ctx.jsonData);
      expect(ctx.jsonData.timeout).toBe(30);

      ctx.jsonData = { schema: 2, timeout: '0' };
      migrateDSConfig(ctx.jsonData);
      expect(ctx.jsonData.timeout).toBe(0);

      ctx.jsonData = { schema: 2, timeout: '' };
      migrateDSConfig(ctx.jsonData);
      expect(ctx.jsonData.timeout).toBeNull();
    });
  });

  describe('When handling provisioned datasource config', () => {
    beforeEach(() => {
      ctx.jsonData = {
        username: 'zabbix',
        password: 'zabbix',
        trends: true,
        trendsFrom: '7d',
        trendsRange: '4d',
        cacheTTL: '1h',
        alerting: true,
        addThresholds: false,
        alertingMinSeverity: 3,
        disableReadOnlyUsersAck: true,
        dbConnectionEnable: true,
        dbConnectionDatasourceName: 'MySQL Zabbix',
        dbConnectionRetentionPolicy: 'one_year',
      };
    });

    it('should not touch anything if schema is up to date', () => {
      const originalConf = _.cloneDeep(ctx.jsonData);
      migrateDSConfig(ctx.jsonData);
      expect(ctx.jsonData).toMatchObject(originalConf);
      expect(ctx.jsonData.dbConnectionEnable).toBe(true);
      expect(ctx.jsonData.dbConnectionDatasourceName).toBeDefined();
    });
  });

  describe('When migrating problem tag filters (schema 13)', () => {
    const problemsTarget = (overrides: any = {}) => ({
      schema: 12,
      queryType: c.MODE_PROBLEMS,
      group: { filter: '' },
      host: { filter: '' },
      application: { filter: '' },
      item: { filter: '' },
      macro: { filter: '' },
      options: {},
      tags: { filter: 'environment:production, service' },
      ...overrides,
    });

    it('should convert the free-text tags filter to structured filters with the Equals operator', () => {
      const target = migrate(problemsTarget());

      expect(target.problemTags).toEqual([
        { tag: 'environment', value: 'production', operator: '1' },
        { tag: 'service', value: '', operator: '1' },
      ]);
      expect(target.tags.filter).toBe('');
      expect(target.schema).toBe(DS_QUERY_SCHEMA);
    });

    it('should produce the exact tags param the legacy text filter sent to the API', () => {
      // Regression guard: dashboards saved before schema 13 must keep returning the
      // same problems. The old code parsed the text filter and sent every tag with
      // operator 1 (Equal) — the migrated structured filters must yield the same param.
      const target = migrate(problemsTarget());

      expect(problemTagsToQueryParam(target.problemTags)).toEqual([
        { tag: 'environment', value: 'production', operator: 1 },
        { tag: 'service', value: '', operator: 1 },
      ]);
    });

    it('should not touch the tags filter of triggers targets', () => {
      const target = migrate(problemsTarget({ queryType: c.MODE_TRIGGERS }));

      expect(target.problemTags).toBeUndefined();
      expect(target.tags.filter).toBe('environment:production, service');
    });

    it('should not overwrite existing structured filters', () => {
      const problemTags = [{ tag: 'app', value: 'db', operator: '4' }];
      const target = migrate(problemsTarget({ problemTags }));

      expect(target.problemTags).toEqual(problemTags);
    });

    it('should not run again when schema is up to date', () => {
      const target = migrate(problemsTarget({ schema: 13 }));

      expect(target.problemTags).toBeUndefined();
      expect(target.tags.filter).toBe('environment:production, service');
    });

    it('should leave targets without a tags filter unchanged', () => {
      const target = migrate(problemsTarget({ tags: { filter: '' } }));

      expect(target.problemTags).toBeUndefined();
    });
  });

  describe('getUIDFromID', () => {
    it('should return the matching datasource uid', () => {
      const getList = jest.fn().mockReturnValue([
        { id: 1, uid: 'datasource-1' },
        { id: 2, uid: 'datasource-2' },
      ]);
      mockedGetDataSourceSrv.mockReturnValue({ getList } as any);

      const uid = getUIDFromID(2);

      expect(uid).toBe('datasource-2');
      expect(getList).toHaveBeenCalledWith({ all: true });
    });

    it('should return undefined when datasource is not found', () => {
      const getList = jest.fn().mockReturnValue([{ id: 1, uid: 'datasource-1' }]);
      mockedGetDataSourceSrv.mockReturnValue({ getList } as any);

      const uid = getUIDFromID(999);

      expect(uid).toBeUndefined();
      expect(getList).toHaveBeenCalledWith({ all: true });
    });
  });
});
