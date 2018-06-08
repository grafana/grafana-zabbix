import _ from 'lodash';

const NOT_IMPLEMENTED = 'Method should be implemented in subclass of DBConnector';

export default class DBConnector {
  constructor(options, backendSrv, datasourceSrv) {
    this.backendSrv = backendSrv;
    this.datasourceSrv = datasourceSrv;
    this.datasourceId = options.datasourceId;
    this.datasourceName = options.datasourceName;
    this.datasourceType = null;
  }

  loadDBDataSource() {
    let ds = _.find(this.datasourceSrv.getAll(), {'id': this.datasourceId});
    if (ds) {
      return this.datasourceSrv.loadDatasource(ds.name)
      .then(ds => {
        this.datasourceType = ds.meta.id;
        return ds;
      });
    } else {
      return Promise.reject(`SQL Data Source with ID ${this.datasourceId} not found`);
    }
  }

  testDataSource() {
    throw NOT_IMPLEMENTED;
  }

  getHistory() {
    throw NOT_IMPLEMENTED;
  }

  getTrends() {
    throw NOT_IMPLEMENTED;
  }
}
