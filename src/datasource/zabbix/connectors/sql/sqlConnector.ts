import _ from 'lodash';
import { getBackendSrv } from '@grafana/runtime';
import { compactQuery } from '../../../utils';
import mysql from './mysql';
import postgres from './postgres';
import dbConnector, {
  DBConnector,
  DEFAULT_QUERY_LIMIT,
  HISTORY_TO_TABLE_MAP,
  TREND_TO_TABLE_MAP,
} from '../dbConnector';

const supportedDatabases = {
  mysql: 'mysql',
  postgresOld: 'postgres',
  postgresNew: 'grafana-postgresql-datasource',
};

export class SQLConnector extends DBConnector {
  private limit: number;
  private sqlDialect: any;

  constructor(options) {
    super(options);

    this.limit = options.limit || DEFAULT_QUERY_LIMIT;
    this.sqlDialect = null;

    super.loadDBDataSource().then(() => {
      this.loadSQLDialect();
    });
  }

  loadSQLDialect() {
    if (
      this.datasourceTypeId === supportedDatabases.postgresOld ||
      this.datasourceTypeId === supportedDatabases.postgresNew
    ) {
      this.sqlDialect = postgres;
    } else {
      this.sqlDialect = mysql;
    }
  }

  /**
   * Try to invoke test query for one of Zabbix database tables.
   */
  testDataSource() {
    const testQuery = this.sqlDialect.testQuery();
    return this.invokeSQLQuery(testQuery);
  }

  getHistory(items, timeFrom, timeTill, options) {
    const { aggFunction, intervalSec } = getAggFunc(timeFrom, timeTill, options);

    // Group items by value type and perform request for each value type
    const grouped_items = _.groupBy(items, 'value_type');
    const promises = _.map(grouped_items, (items, value_type) => {
      const itemids = _.map(items, 'itemid').join(', ');
      const table = HISTORY_TO_TABLE_MAP[value_type];
      let query = this.sqlDialect.historyQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction);

      query = compactQuery(query);
      return this.invokeSQLQuery(query);
    });

    return Promise.all(promises).then((results) => {
      return _.flatten(results);
    });
  }

  getTrends(items, timeFrom, timeTill, options) {
    const { consolidateBy } = options;
    const { aggFunction, intervalSec } = getAggFunc(timeFrom, timeTill, options);

    // Group items by value type and perform request for each value type
    const grouped_items = _.groupBy(items, 'value_type');
    const promises = _.map(grouped_items, (items, value_type) => {
      const itemids = _.map(items, 'itemid').join(', ');
      const table = TREND_TO_TABLE_MAP[value_type];
      let valueColumn = _.includes(['avg', 'min', 'max', 'sum'], consolidateBy) ? consolidateBy : 'avg';
      valueColumn = dbConnector.consolidateByTrendColumns[valueColumn];
      let query = this.sqlDialect.trendsQuery(
        itemids,
        table,
        timeFrom,
        timeTill,
        intervalSec,
        aggFunction,
        valueColumn
      );

      query = compactQuery(query);
      return this.invokeSQLQuery(query);
    });

    return Promise.all(promises).then((results) => {
      return _.flatten(results);
    });
  }

  invokeSQLQuery(query) {
    const queryDef = {
      refId: 'A',
      format: 'time_series',
      datasourceId: this.datasourceId,
      rawSql: query,
      maxDataPoints: this.limit,
    };

    return getBackendSrv()
      .datasourceRequest({
        url: '/api/ds/query',
        method: 'POST',
        data: {
          queries: [queryDef],
        },
      })
      .then((response) => {
        const results = (response.data as { results?: any }).results;
        if (results && results['A']) {
          return results['A'].frames;
        } else {
          return null;
        }
      });
  }
}

function getAggFunc(timeFrom, timeTill, options) {
  const { intervalMs } = options;
  let { consolidateBy } = options;
  let intervalSec = Math.ceil(intervalMs / 1000);

  // The interval must match the time range exactly n times, otherwise
  // the resulting first and last data points will yield invalid values in the
  // calculated average value in downsampleSeries - when using consolidateBy(avg)
  const numOfIntervals = Math.ceil((timeTill - timeFrom) / intervalSec);
  intervalSec = Math.ceil((timeTill - timeFrom) / numOfIntervals);

  consolidateBy = consolidateBy || 'avg';
  const aggFunction = dbConnector.consolidateByFunc[consolidateBy];
  return { aggFunction, intervalSec };
}
