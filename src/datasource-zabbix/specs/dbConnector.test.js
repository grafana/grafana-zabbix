import DBConnector from '../zabbix/connectors/dbConnector';

describe('DBConnector', () => {
  let ctx = {};
  const backendSrvMock = {};
  const datasourceSrvMock = {
    loadDatasource: jest.fn().mockResolvedValue(
      { id: 42, name: 'foo', meta: {} }
    ),
    getAll: jest.fn().mockReturnValue([
      { id: 42, name: 'foo' }
    ])
  };

  describe('When init DB connector', () => {
    beforeEach(() => {
      ctx.options = {
        datasourceId: 42,
        datasourceName: undefined
      };
    });

    it('should load datasource by name by default', () => {
      ctx.options = {
        datasourceName: 'bar'
      };
      const dbConnector = new DBConnector(ctx.options, backendSrvMock, datasourceSrvMock);
      dbConnector.loadDBDataSource();
      expect(datasourceSrvMock.getAll).not.toHaveBeenCalled();
      expect(datasourceSrvMock.loadDatasource).toHaveBeenCalledWith('bar');
    });

    it('should load datasource by id if name not present', () => {
      const dbConnector = new DBConnector(ctx.options, backendSrvMock, datasourceSrvMock);
      dbConnector.loadDBDataSource();
      expect(datasourceSrvMock.getAll).toHaveBeenCalled();
      expect(datasourceSrvMock.loadDatasource).toHaveBeenCalledWith('foo');
    });

    it('should throw error if no name and id specified', () => {
      ctx.options = {};
      const dbConnector = new DBConnector(ctx.options, backendSrvMock, datasourceSrvMock);
      return expect(dbConnector.loadDBDataSource()).rejects.toBe('SQL Data Source name should be specified');
    });

    it('should throw error if datasource with given id is not found', () => {
      ctx.options.datasourceId = 45;
      const dbConnector = new DBConnector(ctx.options, backendSrvMock, datasourceSrvMock);
      return expect(dbConnector.loadDBDataSource()).rejects.toBe('SQL Data Source with ID 45 not found');
    });
  });
});
