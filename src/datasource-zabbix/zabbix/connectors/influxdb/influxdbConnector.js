import _ from 'lodash';
import DBConnector from '../dbConnector';

const DEFAULT_QUERY_LIMIT = 10000;
const HISTORY_TO_TABLE_MAP = {
  '0': 'history',
  '1': 'history_str',
  '2': 'history_log',
  '3': 'history_uint',
  '4': 'history_text'
};

const TREND_TO_TABLE_MAP = {
  '0': 'trends',
  '3': 'trends_uint'
};

const consolidateByFunc = {
  'avg': 'AVG',
  'min': 'MIN',
  'max': 'MAX',
  'sum': 'SUM',
  'count': 'COUNT'
};

const consolidateByTrendColumns = {
  'avg': 'value_avg',
  'min': 'value_min',
  'max': 'value_max',
  'sum': 'num*value_avg' // sum of sums inside the one-hour trend period
};

export class InfluxDBConnector extends DBConnector {
  constructor(options, backendSrv, datasourceSrv) {
    super(options, backendSrv, datasourceSrv);
    this.limit = options.limit || DEFAULT_QUERY_LIMIT;
    super.loadDBDataSource().then(ds => {
      console.log(ds);
      this.ds = ds;
      return ds;
    });
  }

  /**
   * Try to invoke test query for one of Zabbix database tables.
   */
  testDataSource() {
    return this.ds.testDatasource();
  }

  getHistory(items, timeFrom, timeTill, options) {
    let {intervalMs, consolidateBy} = options;
    const intervalSec = Math.ceil(intervalMs / 1000);

    consolidateBy = consolidateBy || 'avg';
    const aggFunction = consolidateByFunc[consolidateBy];

    // Group items by value type and perform request for each value type
    const grouped_items = _.groupBy(items, 'value_type');
    const promises = _.map(grouped_items, (items, value_type) => {
      const itemids = _.map(items, 'itemid');
      const table = HISTORY_TO_TABLE_MAP[value_type];
      const query = this.buildHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction);
      console.log(query);
      return this.invokeInfluxDBQuery(query);
    });

    return Promise.all(promises).then(results => {
      return _.flatten(results);
    });
  }

  getTrends(items, timeFrom, timeTill, options) {
    let { intervalMs, consolidateBy } = options;
    const intervalSec = Math.ceil(intervalMs / 1000);

    consolidateBy = consolidateBy || 'avg';
    const aggFunction = consolidateByFunc[consolidateBy];

    // Group items by value type and perform request for each value type
    const grouped_items = _.groupBy(items, 'value_type');
    const promises = _.map(grouped_items, (items, value_type) => {
      const itemids = _.map(items, 'itemid');
      const table = TREND_TO_TABLE_MAP[value_type];
      let valueColumn = _.includes(['avg', 'min', 'max', 'sum'], consolidateBy) ? consolidateBy : 'avg';
      valueColumn = consolidateByTrendColumns[valueColumn];
      const query = this.buildTrendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn);
      console.log(query);
      return this.invokeInfluxDBQuery(query);
    });

    return Promise.all(promises).then(results => {
      return _.flatten(results);
    });
  }

  buildHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
    const AGG = aggFunction === 'AVG' ? 'MEAN' : aggFunction;
    const where_clause = itemids.map(itemid => `"itemid" = ${itemid}`).join(' AND ');
    const query = `SELECT "itemid", "time", ${AGG}("value") FROM "${table}"
      WHERE ${where_clause} AND "time" >= ${timeFrom} AND "time" <= ${timeTill}
      GROUP BY time(${intervalSec}s)`;
    return compactQuery(query);
  }

  buildTrendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn) {
    const AGG = aggFunction === 'AVG' ? 'MEAN' : aggFunction;
    const where_clause = itemids.map(itemid => `"itemid" = ${itemid}`).join(' AND ');
    const query = `SELECT "itemid", "time", ${AGG}("${valueColumn}") FROM "${table}"
      WHERE ${where_clause} AND "time" >= ${timeFrom} AND "time" <= ${timeTill}
      GROUP BY time(${intervalSec}s)`;
    return compactQuery(query);
  }

  handleGrafanaTSResponse(history, items, addHostName = true) {
    return convertGrafanaTSResponse(history, items, addHostName);
  }

  invokeInfluxDBQuery(query) {
    return this.ds._seriesQuery(query);
  }
}

///////////////////////////////////////////////////////////////////////////////

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

function compactQuery(query) {
  return query.replace(/\s+/g, ' ');
}
