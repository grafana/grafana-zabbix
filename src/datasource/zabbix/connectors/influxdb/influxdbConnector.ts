import {
  DataFrame,
  dataFrameToJSON,
  DataSourceApi,
  Field,
  FieldType,
  MutableDataFrame,
  TIME_SERIES_TIME_FIELD_NAME,
} from '@grafana/data';
import _ from 'lodash';
import { from, lastValueFrom } from 'rxjs';
import { compactQuery } from '../../../utils';
import { consolidateByTrendColumns, HISTORY_TO_TABLE_MAP } from '../dbConnector';
import { InfluxDBConnectorOptions } from '../types';

const consolidateByFunc = {
  avg: 'MEAN',
  min: 'MIN',
  max: 'MAX',
  sum: 'SUM',
  count: 'COUNT',
};

export class InfluxDBConnector {
  private retentionPolicy: string;

  constructor(
    private datasource: DataSourceApi,
    options: InfluxDBConnectorOptions
  ) {
    this.retentionPolicy = options.retentionPolicy;
  }

  /**
   * Try to invoke test query for one of Zabbix database tables.
   */
  async testDataSource() {
    const result = await this.datasource.testDatasource();
    if (result.status && result.status === 'error') {
      return Promise.reject({
        data: {
          message: `InfluxDB connection error: ${result.message}`,
        },
      });
    }
    return {
      ...result,
      dsType: this.datasource.type,
      dsName: this.datasource.name,
    };
  }

  getHistory(items, timeFrom, timeTill, options) {
    const { intervalMs, retentionPolicy } = options;
    let { consolidateBy } = options;
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
      .then((results) => {
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
    const query = `SELECT ${aggregation}("${value}")
                   FROM ${measurement}
                   WHERE ${where_clause}
                     AND "time" >= ${timeFrom}s
                     AND "time" <= ${timeTill}s
                   GROUP BY time(${intervalSec}s), "itemid" fill(none)`;
    return compactQuery(query);
  }

  buildWhereClause(itemids) {
    const itemidsWhere = itemids.map((itemid) => `"itemid" = '${itemid}'`).join(' OR ');
    return `(${itemidsWhere})`;
  }

  async invokeInfluxDBQuery(query) {
    const result = this.datasource.query(query);
    const data = await lastValueFrom(from(result));
    return data.data;
  }
}

///////////////////////////////////////////////////////////////////////////////

function handleInfluxHistoryResponse(results) {
  if (!results) {
    return [];
  }

  const frames: DataFrame[] = [];
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
      const tsBuffer = [];
      const valuesBuffer = [];
      if (influxSeries.values) {
        for (i = 0; i < influxSeries.values.length; i++) {
          tsBuffer.push(influxSeries.values[i][0]);
          valuesBuffer.push(influxSeries.values[i][1]);
        }
      }
      const timeFiled: Field<number> = {
        name: TIME_SERIES_TIME_FIELD_NAME,
        type: FieldType.time,
        config: {},
        values: tsBuffer,
      };

      const valueFiled: Field<number | null> = {
        name: influxSeries?.tags?.itemid,
        type: FieldType.number,
        config: {},
        values: valuesBuffer,
      };

      frames.push(
        new MutableDataFrame({
          name: influxSeries?.tags?.itemid,
          fields: [timeFiled, valueFiled],
        })
      );
    }
  }

  return frames.map((f) => dataFrameToJSON(f));
}
