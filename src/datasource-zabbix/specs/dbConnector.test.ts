import { DBConnector } from '../zabbix/connectors/dbConnector';

const loadDatasourceMock = jest.fn().mockResolvedValue({ id: 42, name: 'foo', meta: {} });
const getAllMock = jest.fn().mockReturnValue([{ id: 42, name: 'foo', meta: {} }]);

jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => ({
    loadDatasource: loadDatasourceMock,
    getAll: getAllMock
  }),
}));

describe('DBConnector', () => {
  const ctx: any = {};

  describe('When init DB connector', () => {
    beforeEach(() => {
      ctx.options = {
        datasourceId: 42,
        datasourceName: undefined
      };

      loadDatasourceMock.mockClear();
      getAllMock.mockClear();
    });

    it('should try to load datasource by name first', () => {
      const dbConnector = new DBConnector({ datasourceName: 'bar' });
      dbConnector.loadDBDataSource();
      expect(getAllMock).not.toHaveBeenCalled();
      expect(loadDatasourceMock).toHaveBeenCalledWith('bar');
    });

    it('should load datasource by id if name not present', () => {
      const dbConnector = new DBConnector({ datasourceId: 42 });
      dbConnector.loadDBDataSource();
      expect(getAllMock).toHaveBeenCalled();
      expect(loadDatasourceMock).toHaveBeenCalledWith('foo');
    });

    it('should throw error if no name and id specified', () => {
      ctx.options = {};
      const dbConnector = new DBConnector(ctx.options);
      return expect(dbConnector.loadDBDataSource()).rejects.toBe('Data Source name should be specified');
    });

    it('should throw error if datasource with given id is not found', () => {
      ctx.options.datasourceId = 45;
      const dbConnector = new DBConnector(ctx.options);
      return expect(dbConnector.loadDBDataSource()).rejects.toBe('Data Source with ID 45 not found');
    });
  });
});
