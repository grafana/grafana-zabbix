import { migrateDSConfig, DS_CONFIG_SCHEMA } from '../migrations';

describe('Migrations', () => {
  let ctx = {};

  describe('When migrating datasource config', () => {
    beforeEach(() => {
      ctx.jsonData = {
        dbConnection: {
          enable: true,
          datasourceId: 1
        }
      };
    });

    it('should change direct DB connection setting to flat style', () => {
      migrateDSConfig(ctx.jsonData);
      expect(ctx.jsonData).toMatchObject({
        dbConnectionEnable: true,
        dbConnectionDatasourceId: 1,
        schema: DS_CONFIG_SCHEMA
      });
    });

    it('should not touch anything if schema is up to date', () => {
      ctx.jsonData = {
        futureOptionOne: 'foo',
        futureOptionTwo: 'bar',
        schema: DS_CONFIG_SCHEMA
      };
      migrateDSConfig(ctx.jsonData);
      expect(ctx.jsonData).toMatchObject({
        futureOptionOne: 'foo',
        futureOptionTwo: 'bar',
        schema: DS_CONFIG_SCHEMA
      });
      expect(ctx.jsonData.dbConnectionEnable).toBeUndefined();
      expect(ctx.jsonData.dbConnectionDatasourceId).toBeUndefined();
    });
  });
});
