'use strict';

System.register(['../zabbix/connectors/dbConnector'], function (_export, _context) {
  "use strict";

  var DBConnector;
  return {
    setters: [function (_zabbixConnectorsDbConnector) {
      DBConnector = _zabbixConnectorsDbConnector.default;
    }],
    execute: function () {

      describe('DBConnector', function () {
        var ctx = {};
        var backendSrvMock = {};
        var datasourceSrvMock = {
          loadDatasource: jest.fn().mockResolvedValue({ id: 42, name: 'foo', meta: {} }),
          getAll: jest.fn().mockReturnValue([{ id: 42, name: 'foo' }])
        };

        describe('When init DB connector', function () {
          beforeEach(function () {
            ctx.options = {
              datasourceId: 42,
              datasourceName: undefined
            };
          });

          it('should load datasource by name by default', function () {
            ctx.options = {
              datasourceName: 'bar'
            };
            var dbConnector = new DBConnector(ctx.options, backendSrvMock, datasourceSrvMock);
            dbConnector.loadDBDataSource();
            expect(datasourceSrvMock.getAll).not.toHaveBeenCalled();
            expect(datasourceSrvMock.loadDatasource).toHaveBeenCalledWith('bar');
          });

          it('should load datasource by id if name not present', function () {
            var dbConnector = new DBConnector(ctx.options, backendSrvMock, datasourceSrvMock);
            dbConnector.loadDBDataSource();
            expect(datasourceSrvMock.getAll).toHaveBeenCalled();
            expect(datasourceSrvMock.loadDatasource).toHaveBeenCalledWith('foo');
          });

          it('should throw error if no name and id specified', function () {
            ctx.options = {};
            var dbConnector = new DBConnector(ctx.options, backendSrvMock, datasourceSrvMock);
            return expect(dbConnector.loadDBDataSource()).rejects.toBe('SQL Data Source name should be specified');
          });

          it('should throw error if datasource with given id is not found', function () {
            ctx.options.datasourceId = 45;
            var dbConnector = new DBConnector(ctx.options, backendSrvMock, datasourceSrvMock);
            return expect(dbConnector.loadDBDataSource()).rejects.toBe('SQL Data Source with ID 45 not found');
          });
        });
      });
    }
  };
});
//# sourceMappingURL=dbConnector.test.js.map
