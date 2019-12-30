import _ from 'lodash';

export const DEFAULT_QUERY_LIMIT = 10000;
export const HISTORY_TO_TABLE_MAP = {
  '0': 'history',
  '1': 'history_str',
  '2': 'history_log',
  '3': 'history_uint',
  '4': 'history_text'
};

export const TREND_TO_TABLE_MAP = {
  '0': 'trends',
  '3': 'trends_uint'
};

export const consolidateByFunc = {
  'avg': 'AVG',
  'min': 'MIN',
  'max': 'MAX',
  'sum': 'SUM',
  'count': 'COUNT'
};

export const consolidateByTrendColumns = {
  'avg': 'value_avg',
  'min': 'value_min',
  'max': 'value_max',
  'sum': 'num*value_avg' // sum of sums inside the one-hour trend period
};

/**
 * Base class for external history database connectors. Subclasses should implement `getHistory()`, `getTrends()` and
 * `testDataSource()` methods, which describe how to fetch data from source other than Zabbix API.
 */
export class DBConnector {
  constructor(options, datasourceSrv) {
    this.datasourceSrv = datasourceSrv;
    this.datasourceId = options.datasourceId;
    this.datasourceName = options.datasourceName;
    this.datasourceTypeId = null;
    this.datasourceTypeName = null;
  }

  static loadDatasource(dsId, dsName, datasourceSrv) {
    if (!dsName && dsId !== undefined) {
      let ds = _.find(datasourceSrv.getAll(), {'id': dsId});
      if (!ds) {
        return Promise.reject(`Data Source with ID ${dsId} not found`);
      }
      dsName = ds.name;
    }
    if (dsName) {
      return datasourceSrv.loadDatasource(dsName);
    } else {
      return Promise.reject(`Data Source name should be specified`);
    }
  }

  loadDBDataSource() {
    return DBConnector.loadDatasource(this.datasourceId, this.datasourceName, this.datasourceSrv)
    .then(ds => {
      this.datasourceTypeId = ds.meta.id;
      this.datasourceTypeName = ds.meta.name;
      if (!this.datasourceName) {
        this.datasourceName = ds.name;
      }
      if (!this.datasourceId) {
        this.datasourceId = ds.id;
      }
      return ds;
    });
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

const defaults = {
  DBConnector,
  DEFAULT_QUERY_LIMIT,
  HISTORY_TO_TABLE_MAP,
  TREND_TO_TABLE_MAP,
  consolidateByFunc,
  consolidateByTrendColumns
};

export default defaults;
