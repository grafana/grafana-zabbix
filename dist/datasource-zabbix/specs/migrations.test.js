'use strict';

System.register(['../migrations'], function (_export, _context) {
  "use strict";

  var migrateDSConfig, DS_CONFIG_SCHEMA;
  return {
    setters: [function (_migrations) {
      migrateDSConfig = _migrations.migrateDSConfig;
      DS_CONFIG_SCHEMA = _migrations.DS_CONFIG_SCHEMA;
    }],
    execute: function () {

      describe('Migrations', function () {
        var ctx = {};

        describe('When migrating datasource config', function () {
          beforeEach(function () {
            ctx.jsonData = {
              dbConnection: {
                enable: true,
                datasourceId: 1
              }
            };
          });

          it('should change direct DB connection setting to flat style', function () {
            migrateDSConfig(ctx.jsonData);
            expect(ctx.jsonData).toMatchObject({
              dbConnectionEnable: true,
              dbConnectionDatasourceId: 1,
              schema: DS_CONFIG_SCHEMA
            });
          });

          it('should not touch anything if schema is up to date', function () {
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
    }
  };
});
//# sourceMappingURL=migrations.test.js.map
