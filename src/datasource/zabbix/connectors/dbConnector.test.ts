import { DBConnector } from './dbConnector';

const loadDatasourceMock = jest.fn().mockResolvedValue({ id: 42, name: 'foo', meta: {} });
const getAllMock = jest.fn().mockReturnValue([{ uid: 'datasource-1', id: 42, name: 'foo', meta: {} }]);

jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => ({
    get: loadDatasourceMock,
    getList: getAllMock,
  }),
}));

describe('DBConnector', () => {
  const ctx: any = {};

  describe('When init DB connector', () => {
    beforeEach(() => {
      ctx.options = {
        datasourceId: 42,
        datasourceName: undefined,
      };

      loadDatasourceMock.mockClear();
      getAllMock.mockClear();
    });

    it('should try to load datasource by name first', () => {
      const dbConnector = new DBConnector({ datasourceName: 'bar', datasourceUID: undefined });
      dbConnector.loadDBDataSource();
      expect(getAllMock).not.toHaveBeenCalled();
      expect(loadDatasourceMock).toHaveBeenCalledWith('bar');
    });

    it('should load datasource by UID if name not present', () => {
      const dbConnector = new DBConnector({ datasourceUID: 'datasource-1', datasourceName: undefined });
      dbConnector.loadDBDataSource();
      expect(getAllMock).toHaveBeenCalled();
      expect(loadDatasourceMock).toHaveBeenCalledWith('foo');
    });

    it('should throw error if no name and id specified', () => {
      ctx.options = {};
      const dbConnector = new DBConnector(ctx.options);
      return expect(dbConnector.loadDBDataSource()).rejects.toBe('Data Source name should be specified');
    });

    it('should throw error if datasource with given UID is not found', () => {
      ctx.options.datasourceUID = 'datasource-2';
      const dbConnector = new DBConnector(ctx.options);
      return expect(dbConnector.loadDBDataSource()).rejects.toBe('Data Source with UID datasource-2 not found');
    });
  });
});
