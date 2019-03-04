import _ from 'lodash';
import { compactQuery } from '../../../utils';
import { DBConnector, HISTORY_TO_TABLE_MAP, consolidateByTrendColumns } from '../dbConnector';

const consolidateByFunc = {
  'avg': 'MEAN',
  'min': 'MIN',
  'max': 'MAX',
  'sum': 'SUM',
  'count': 'COUNT'
};

export class InfluxDBConnector extends DBConnector {
  constructor(options, datasourceSrv) {
    super(options, datasourceSrv);
    this.retentionPolicy = options.retentionPolicy;
    super.loadDBDataSource().then(ds => {
      this.influxDS = ds;
      return ds;
    });
  }

  /**
   * Try to invoke test query for one of Zabbix database tables.
   */
  testDataSource() {
    return this.influxDS.testDatasource();
  }

  getHistory(items, timeFrom, timeTill, options) {
    let { intervalMs, consolidateBy, retentionPolicy } = options;
    const intervalSec = Math.ceil(intervalMs / 1000);

    const range = { timeFrom, timeTill };
    consolidateBy = consolidateBy || 'avg';

    // Group items by value type and perform request for each value type
    const grouped_items = _.groupBy(items, 'value_type');
    const promises = _.map(grouped_items, (items, value_type) => {
      const itemids = _.map(items, 'itemid');
      const table = HISTORY_TO_TABLE_MAP[value_type];
      const query = this.buildHistoryQuery(itemids, table, range, intervalSec, consolidateBy, retentionPolicy);
      return this.invokeInfluxDBQuery(query);
    });

    return Promise.all(promises)
    .then(_.flatten)
    .then(results => {
      return handleInfluxHistoryResponse(results);
    });
  }

  getTrends(items, timeFrom, timeTill, options) {
    options.retentionPolicy = this.retentionPolicy;
    return this.getHistory(items, timeFrom, timeTill, options);
  }

  buildHistoryQuery(itemids, table, range, intervalSec, aggFunction, retentionPolicy) {
    const { timeFrom, timeTill } = range;
    const measurement = retentionPolicy ? `"${retentionPolicy}"."${table}"` : `"${table}"`;
    let value = 'value';
    if (retentionPolicy) {
      value = consolidateByTrendColumns[aggFunction] || 'value_avg';
    }
    const aggregation = consolidateByFunc[aggFunction] || aggFunction;
    const where_clause = this.buildWhereClause(itemids);
    const query = `SELECT ${aggregation}("${value}") FROM ${measurement}
      WHERE ${where_clause} AND "time" >= ${timeFrom}s AND "time" <= ${timeTill}s
      GROUP BY time(${intervalSec}s), "itemid" fill(none)`;
    return compactQuery(query);
  }

  buildWhereClause(itemids) {
    const itemidsWhere = itemids.map(itemid => `"itemid" = '${itemid}'`).join(' OR ');
    return `(${itemidsWhere})`;
  }

  invokeInfluxDBQuery(query) {
    return this.influxDS._seriesQuery(query)
    .then(data => data && data.results ? data.results : []);
  }
}

///////////////////////////////////////////////////////////////////////////////

function handleInfluxHistoryResponse(results) {
  if (!results) {
    return [];
  }

  const seriesList = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (result.error) {
      const error = `InfluxDB error: ${result.error}`;
      return Promise.reject(new Error(error));
    }

    if (!result || !result.series) {
      continue;
    }

    const influxSeriesList = results[i].series;

    for (let y = 0; y < influxSeriesList.length; y++) {
      const influxSeries = influxSeriesList[y];
      const datapoints = [];
      if (influxSeries.values) {
        for (i = 0; i < influxSeries.values.length; i++) {
          datapoints[i] = [influxSeries.values[i][1], influxSeries.values[i][0]];
        }
      }
      const timeSeries = {
        name: influxSeries.tags.itemid,
        points: datapoints
      };
      seriesList.push(timeSeries);
    }
  }

  return seriesList;
}
