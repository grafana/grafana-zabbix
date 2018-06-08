import _ from 'lodash';
import mysql from './mysql';
import postgres from './postgres';
import DBConnector from '../dbConnector';

const supportedDatabases = {
  mysql: 'mysql',
  postgres: 'postgres'
};

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
  'max': 'value_max'
};

export class SQLConnector extends DBConnector {
  constructor(options, backendSrv, datasourceSrv) {
    super(options, backendSrv, datasourceSrv);

    this.limit = options.limit || DEFAULT_QUERY_LIMIT;
    this.sqlDialect = null;

    super.loadDBDataSource()
    .then(() => this.loadSQLDialect());
  }

  loadSQLDialect() {
    if (this.datasourceType === supportedDatabases.postgres) {
      this.sqlDialect = postgres;
    } else {
      this.sqlDialect = mysql;
    }
  }

  /**
   * Try to invoke test query for one of Zabbix database tables.
   */
  testDataSource() {
    let testQuery = this.sqlDialect.testQuery();
    return this.invokeSQLQuery(testQuery);
  }

  getHistory(items, timeFrom, timeTill, options) {
    let {intervalMs, consolidateBy} = options;
    let intervalSec = Math.ceil(intervalMs / 1000);

    consolidateBy = consolidateBy || 'avg';
    let aggFunction = consolidateByFunc[consolidateBy];

    // Group items by value type and perform request for each value type
    let grouped_items = _.groupBy(items, 'value_type');
    let promises = _.map(grouped_items, (items, value_type) => {
      let itemids = _.map(items, 'itemid').join(', ');
      let table = HISTORY_TO_TABLE_MAP[value_type];
      let query = this.sqlDialect.historyQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction);

      query = compactSQLQuery(query);
      return this.invokeSQLQuery(query);
    });

    return Promise.all(promises).then(results => {
      return _.flatten(results);
    });
  }

  getTrends(items, timeFrom, timeTill, options) {
    let { intervalMs, consolidateBy } = options;
    let intervalSec = Math.ceil(intervalMs / 1000);

    consolidateBy = consolidateBy || 'avg';
    let aggFunction = consolidateByFunc[consolidateBy];

    // Group items by value type and perform request for each value type
    let grouped_items = _.groupBy(items, 'value_type');
    let promises = _.map(grouped_items, (items, value_type) => {
      let itemids = _.map(items, 'itemid').join(', ');
      let table = TREND_TO_TABLE_MAP[value_type];
      let valueColumn = _.includes(['avg', 'min', 'max'], consolidateBy) ? consolidateBy : 'avg';
      valueColumn = consolidateByTrendColumns[valueColumn];
      let query = this.sqlDialect.trendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn);

      query = compactSQLQuery(query);
      return this.invokeSQLQuery(query);
    });

    return Promise.all(promises).then(results => {
      return _.flatten(results);
    });
  }

  handleGrafanaTSResponse(history, items, addHostName = true) {
    return convertGrafanaTSResponse(history, items, addHostName);
  }

  invokeSQLQuery(query) {
    let queryDef = {
      refId: 'A',
      format: 'time_series',
      datasourceId: this.datasourceId,
      rawSql: query,
      maxDataPoints: this.limit
    };

    return this.backendSrv.datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data: {
        queries: [queryDef],
      }
    })
    .then(response => {
      let results = response.data.results;
      if (results['A']) {
        return results['A'].series;
      } else {
        return null;
      }
    });
  }
}

///////////////////////////////////////////////////////////////////////////////

function convertGrafanaTSResponse(time_series, items, addHostName) {
  //uniqBy is needed to deduplicate
  var hosts = _.uniqBy(_.flatten(_.map(items, 'hosts')), 'hostid');
  let grafanaSeries = _.map(time_series, series => {
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

function compactSQLQuery(query) {
  return query.replace(/\s+/g, ' ');
}
