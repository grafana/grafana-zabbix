import _ from 'lodash';
import { getDataSourceSrv } from '@grafana/runtime';
import { getUIDFromID, migrateDSConfig, DS_CONFIG_SCHEMA } from './migrations';

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
