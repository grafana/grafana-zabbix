import _ from 'lodash';
import { DBConnector, HISTORY_TO_TABLE_MAP, consolidateByFunc } from '../dbConnector';

export class InfluxDBConnector extends DBConnector {
  constructor(options, datasourceSrv) {
    super(options, datasourceSrv);
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
    let {intervalMs, consolidateBy} = options;
    const intervalSec = Math.ceil(intervalMs / 1000);

    consolidateBy = consolidateBy || 'avg';
    const aggFunction = consolidateByFunc[consolidateBy] || consolidateBy;

    // Group items by value type and perform request for each value type
    const grouped_items = _.groupBy(items, 'value_type');
    const promises = _.map(grouped_items, (items, value_type) => {
      const itemids = _.map(items, 'itemid');
      const table = HISTORY_TO_TABLE_MAP[value_type];
      const query = this.buildHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction);
      return this.invokeInfluxDBQuery(query);
    });

    return Promise.all(promises)
    .then(_.flatten)
    .then(results => {
      return handleInfluxHistoryResponse(results);
    });
  }

  getTrends(items, timeFrom, timeTill, options) {
    return this.getHistory(items, timeFrom, timeTill, options);
  }

  buildHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
    const AGG = aggFunction === 'AVG' ? 'MEAN' : aggFunction;
    const where_clause = this.buildWhereClause(itemids);
    const query = `SELECT ${AGG}("value") FROM "${table}"
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

function compactQuery(query) {
  return query.replace(/\s+/g, ' ');
}
