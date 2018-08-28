import _ from 'lodash';

const NOT_IMPLEMENTED = 'Method should be implemented in subclass of DBConnector';

/**
 * Base class for external history database connectors. Subclasses should implement `getHistory()`, `getTrends()` and
 * `testDataSource()` methods, which describe how to fetch data from source other than Zabbix API.
 */
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

  /**
   * Send test request to datasource in order to ensure it's working.
   */
  testDataSource() {
    throw NOT_IMPLEMENTED;
  }

  /**
   * Get history data from external sources.
   */
  getHistory() {
    throw NOT_IMPLEMENTED;
  }

  /**
   * Get trends data from external sources.
   */
  getTrends() {
    throw NOT_IMPLEMENTED;
  }
}
