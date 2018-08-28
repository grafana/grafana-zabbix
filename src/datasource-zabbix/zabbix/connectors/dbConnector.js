import _ from 'lodash';

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
    this.datasourceTypeId = null;
    this.datasourceTypeName = null;
  }

  loadDBDataSource() {
    let ds = _.find(this.datasourceSrv.getAll(), {'id': this.datasourceId});
    if (ds) {
      return this.datasourceSrv.loadDatasource(ds.name)
      .then(ds => {
        this.datasourceName = ds.name;
        this.datasourceTypeId = ds.meta.id;
        this.datasourceTypeName = ds.meta.name;
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
    throw new ZabbixNotImplemented('testDataSource()');
  }

  /**
   * Get history data from external sources.
   */
  getHistory() {
    throw new ZabbixNotImplemented('getHistory()');
  }

  /**
   * Get trends data from external sources.
   */
  getTrends() {
    throw new ZabbixNotImplemented('getTrends()');
  }
}

// Define Zabbix DB Connector exception type for non-implemented methods
export class ZabbixNotImplemented {
  constructor(methodName) {
    this.code = null;
    this.name = 'ZabbixNotImplemented';
    this.message = `Zabbix DB Connector Error: method ${methodName || ''} should be implemented in subclass of DBConnector`;
  }

  toString() {
    return this.message;
  }
}
