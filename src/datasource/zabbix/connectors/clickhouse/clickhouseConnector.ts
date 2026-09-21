import {
  DataFrame,
  dataFrameToJSON,
  DataFrameJSON,
  DataSourceApi,
  Field,
  FieldType,
  TIME_SERIES_TIME_FIELD_NAME,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import _ from 'lodash';
import { compactQuery } from '../../../utils';
import { consolidateByFunc, DEFAULT_QUERY_LIMIT, HISTORY_TO_TABLE_MAP } from '../dbConnector';
import { ClickHouseConnectorOptions } from '../types';

export const CLICKHOUSE_DS_ID = 'grafana-clickhouse-datasource';

export class ClickHouseConnector {
  private limit: number;

  constructor(
    private datasource: DataSourceApi,
    options: ClickHouseConnectorOptions
  ) {
    this.limit = options.limit || DEFAULT_QUERY_LIMIT;
  }

  /**
   * Try to invoke test query for one of Zabbix database tables.
   */
  async testDataSource() {
    const result = await this.datasource.testDatasource();
    if (result.status && result.status === 'error') {
      return Promise.reject({
        data: {
          message: `ClickHouse connection error: ${result.message}`,
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
    const { aggFunction, intervalSec } = getAggFunc(timeFrom, timeTill, options);

    // Group items by value type and perform request for each value type
    const grouped_items = _.groupBy(items, 'value_type');
    const promises = _.map(grouped_items, (items, value_type) => {
      const itemids = _.map(items, 'itemid').join(', ');
      const table = HISTORY_TO_TABLE_MAP[value_type];
      const query = compactQuery(this.buildHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction));
      return this.invokeClickHouseQuery(query);
    });

    return Promise.all(promises).then(_.flatten).then(handleClickHouseResponse);
  }

  // Zabbix ClickHouse history storage keeps only raw history data (there are no
  // trends tables), so trends requests are served from history.
  getTrends(items, timeFrom, timeTill, options) {
    return this.getHistory(items, timeFrom, timeTill, options);
  }

  buildHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
    // Zabbix ClickHouse schema stores the timestamp as clock_ns DateTime64(9)
    return `
      SELECT toString(itemid) AS metric, intDiv(toUnixTimestamp(toDateTime(clock_ns)), ${intervalSec}) * ${intervalSec} AS time, ${aggFunction}(value) AS value
      FROM ${table}
      WHERE itemid IN (${itemids})
        AND clock_ns > toDateTime64(${timeFrom}, 9)
        AND clock_ns < toDateTime64(${timeTill}, 9)
      GROUP BY metric, time
      ORDER BY time ASC
    `;
  }

  invokeClickHouseQuery(query: string) {
    const queryDef = {
      refId: 'A',
      datasource: {
        type: this.datasource.type,
        uid: this.datasource.uid,
      },
      editorType: 'sql',
      rawSql: query,
      // Table format (1): keep the response as a single long frame with
      // metric/time/value columns and pivot it to per-item frames ourselves
      format: 1,
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

///////////////////////////////////////////////////////////////////////////////

// Converts long frames (metric, time, value) to per-item frames where the value
// field name is the itemid and time is in milliseconds, as expected by
// responseHandler.dataResponseToTimeSeries()
export function handleClickHouseResponse(frames: Array<DataFrameJSON | null>): DataFrameJSON[] {
  const outFrames: DataFrame[] = [];

  for (const frameJSON of frames || []) {
    if (!frameJSON?.schema?.fields || !frameJSON?.data?.values) {
      continue;
    }

    const fieldNames = frameJSON.schema.fields.map((f) => f.name);
    const metricIndex = fieldNames.indexOf('metric');
    const timeIndex = fieldNames.indexOf('time');
    const valueIndex = fieldNames.indexOf('value');
    if (metricIndex < 0 || timeIndex < 0 || valueIndex < 0) {
      continue;
    }

    const metrics = frameJSON.data.values[metricIndex];
    const times = frameJSON.data.values[timeIndex];
    const values = frameJSON.data.values[valueIndex];

    const grouped: Record<string, { ts: number[]; values: Array<number | null> }> = {};
    for (let i = 0; i < metrics.length; i++) {
      const itemid = String(metrics[i]);
      let group = grouped[itemid];
      if (!group) {
        group = grouped[itemid] = { ts: [], values: [] };
      }
      group.ts.push((times[i] as number) * 1000);
      group.values.push(values[i] as number | null);
    }

    for (const itemid of Object.keys(grouped)) {
      const timeField: Field<number> = {
        name: TIME_SERIES_TIME_FIELD_NAME,
        type: FieldType.time,
        config: {},
        values: grouped[itemid].ts,
      };

      const valueField: Field<number | null> = {
        name: itemid,
        type: FieldType.number,
        config: {},
        values: grouped[itemid].values,
      };

      outFrames.push({
        name: itemid,
        fields: [timeField, valueField],
        length: grouped[itemid].values.length,
      });
    }
  }

  return outFrames.map((f) => dataFrameToJSON(f));
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
  const aggFunction = consolidateByFunc[consolidateBy];
  return { aggFunction, intervalSec };
}
