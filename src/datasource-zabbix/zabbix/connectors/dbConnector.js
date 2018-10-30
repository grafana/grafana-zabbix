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
    if (!this.datasourceName && this.datasourceId !== undefined) {
      let ds = _.find(this.datasourceSrv.getAll(), {'id': this.datasourceId});
      if (!ds) {
        return Promise.reject(`SQL Data Source with ID ${this.datasourceId} not found`);
      }
      this.datasourceName = ds.name;
    }
    if (this.datasourceName) {
      return this.datasourceSrv.loadDatasource(this.datasourceName)
      .then(ds => {
        this.datasourceTypeId = ds.meta.id;
        this.datasourceTypeName = ds.meta.name;
        return ds;
      });
    } else {
      return Promise.reject(`SQL Data Source name should be specified`);
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

  handleGrafanaTSResponse(history, items, addHostName = true) {
    return convertGrafanaTSResponse(history, items, addHostName);
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

/**
 * Converts time series returned by the data source into format that Grafana expects
 * time_series is Array of series:
 * ```
 * [{
 *     name: string,
 *     points: Array<[value: number, timestamp: number]>
 * }]
 * ```
 */
function convertGrafanaTSResponse(time_series, items, addHostName) {
  //uniqBy is needed to deduplicate
  var hosts = _.uniqBy(_.flatten(_.map(items, 'hosts')), 'hostid');
  let grafanaSeries = _.map(_.compact(time_series), series => {
    let itemid = series.name;
    var item = _.find(items, {'itemid': itemid});
    var alias = item.name;
    //only when actual multi hosts selected
    if (_.keys(hosts).length > 1 && addHostName) {
      var host = _.find(hosts, {'hostid': item.hostid});
      alias = host.name + ": " + alias;
    }
    // CachingProxy deduplicates requests and returns one time series for equal queries.
    // Clone is needed to prevent changing of series object shared between all targets.
    let datapoints = _.cloneDeep(series.points);
    return {
      target: alias,
      datapoints: datapoints
    };
  });

  return _.sortBy(grafanaSeries, 'target');
}
