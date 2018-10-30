import mocks from '../../test-setup/mocks';
import { DBConnector } from '../zabbix/connectors/dbConnector';

describe('DBConnector', () => {
  let ctx = {};
  const datasourceSrv = mocks.datasourceSrvMock;
  datasourceSrv.loadDatasource.mockResolvedValue({ id: 42, name: 'foo', meta: {} });
  datasourceSrv.getAll.mockReturnValue([{ id: 42, name: 'foo' }]);

  describe('When init DB connector', () => {
    beforeEach(() => {
      ctx.options = {
        datasourceId: 42,
        datasourceName: undefined
      };
    });

    it('should try to load datasource by name first', () => {
      ctx.options = {
        datasourceName: 'bar'
      };
      const dbConnector = new DBConnector(ctx.options, datasourceSrv);
      dbConnector.loadDBDataSource();
      expect(datasourceSrv.getAll).not.toHaveBeenCalled();
      expect(datasourceSrv.loadDatasource).toHaveBeenCalledWith('bar');
    });

    it('should load datasource by id if name not present', () => {
      const dbConnector = new DBConnector(ctx.options, datasourceSrv);
      dbConnector.loadDBDataSource();
      expect(datasourceSrv.getAll).toHaveBeenCalled();
      expect(datasourceSrv.loadDatasource).toHaveBeenCalledWith('foo');
    });

    it('should throw error if no name and id specified', () => {
      ctx.options = {};
      const dbConnector = new DBConnector(ctx.options, datasourceSrv);
      return expect(dbConnector.loadDBDataSource()).rejects.toBe('Data Source name should be specified');
    });

    it('should throw error if datasource with given id is not found', () => {
      ctx.options.datasourceId = 45;
      const dbConnector = new DBConnector(ctx.options, datasourceSrv);
      return expect(dbConnector.loadDBDataSource()).rejects.toBe('Data Source with ID 45 not found');
    });
  });
});
