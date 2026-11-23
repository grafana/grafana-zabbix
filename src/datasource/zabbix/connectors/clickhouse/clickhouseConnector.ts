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
import { DEFAULT_ZABBIX_LOGS_LIMIT } from '../../../constants';
import { ApmAttributeFilter, ZabbixMetricsQuery } from '../../../types/query';
import { compactQuery } from '../../../utils';
import { consolidateByFunc, DEFAULT_QUERY_LIMIT, HISTORY_TO_TABLE_MAP } from '../dbConnector';
import { ClickHouseConnectorOptions } from '../types';

export const CLICKHOUSE_DS_ID = 'grafana-clickhouse-datasource';

// OTEL attribute map columns of the otel_logs table, by ApmAttributeFilter scope
const APM_ATTRIBUTE_COLUMNS: Record<string, string> = {
  resource: 'ResourceAttributes',
  scope: 'ScopeAttributes',
  log: 'LogAttributes',
};

export class ClickHouseConnector {
  private limit: number;

  constructor(
    private datasource: DataSourceApi,
    options: ClickHouseConnectorOptions
  ) {
    this.limit = options.limit || DEFAULT_QUERY_LIMIT;
  }

  /**
   * Test the connection by running the ClickHouse data source's own health check.
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

  /**
   * Fetch OTEL log records directly from the Zabbix ClickHouse telemetry storage
   * (otel_logs table), in the same record shape as the apmlog.get API. Fetches the
   * most recent entries (DESC + limit); handleAPMLogs() re-sorts lines ascending.
   */
  getAPMLogs(target: ZabbixMetricsQuery, timeFrom: number, timeTill: number): Promise<any[]> {
    const query = compactQuery(this.buildAPMLogsQuery(target, timeFrom, timeTill));
    return this.invokeClickHouseQuery(query).then(handleClickHouseLogsResponse);
  }

  buildAPMLogsQuery(target: ZabbixMetricsQuery, timeFrom: number, timeTill: number): string {
    const conditions = [
      `Timestamp >= toDateTime64(${Number(timeFrom)}, 9)`,
      `Timestamp <= toDateTime64(${Number(timeTill)}, 9)`,
    ];

    const apmFilter = target.apmFilter || {};
    if (apmFilter.service) {
      conditions.push(`ServiceName = ${escapeValue(apmFilter.service)}`);
    }
    if (apmFilter.traceId) {
      conditions.push(`TraceId = ${escapeValue(apmFilter.traceId)}`);
    }
    if (apmFilter.minSeverity) {
      conditions.push(`SeverityNumber >= ${Number(apmFilter.minSeverity)}`);
    }
    if (target.textFilter) {
      // Same semantics as the apmlog.get body search: case-insensitive substring
      conditions.push(`positionCaseInsensitive(Body, ${escapeValue(target.textFilter)}) > 0`);
    }
    for (const attr of (apmFilter.attributes || []).filter((a) => a.key)) {
      const column = APM_ATTRIBUTE_COLUMNS[attr.scope];
      if (column) {
        conditions.push(buildAttributeCondition(column, attr));
      }
    }

    const limit = Number(target.options?.limit) || DEFAULT_ZABBIX_LOGS_LIMIT;
    return `
      SELECT toUnixTimestamp64Nano(Timestamp) AS timestamp, Body AS body,
        SeverityText AS severity_text, SeverityNumber AS severity_number,
        ServiceName AS service_name, TraceId AS traceid, SpanId AS spanid,
        EventName AS event_name, ScopeName AS scope_name,
        toJSONString(ResourceAttributes) AS resource_attributes,
        toJSONString(ScopeAttributes) AS scope_attributes,
        toJSONString(LogAttributes) AS log_attributes
      FROM otel_logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY Timestamp DESC
      LIMIT ${limit}
    `;
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

// Escape a value for use as a single-quoted ClickHouse string literal
function escapeValue(value: string): string {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// Build a WHERE condition for one OTEL attribute filter, following the apmlog.get
// operator semantics (0 Contains, 1 Equals, 2 Does not contain, 3 Does not equal,
// 4 Exists, 5 Does not exist). Like the Zabbix tag filters, the negated operators
// also match records without the attribute.
function buildAttributeCondition(column: string, attr: ApmAttributeFilter): string {
  const key = escapeValue(attr.key);
  const value = escapeValue(attr.value || '');
  switch (attr.operator) {
    case 1: // Equals
      return `(mapContains(${column}, ${key}) AND ${column}[${key}] = ${value})`;
    case 2: // Does not contain
      return `(NOT mapContains(${column}, ${key}) OR positionCaseInsensitive(${column}[${key}], ${value}) = 0)`;
    case 3: // Does not equal
      return `(NOT mapContains(${column}, ${key}) OR ${column}[${key}] != ${value})`;
    case 4: // Exists
      return `mapContains(${column}, ${key})`;
    case 5: // Does not exist
      return `NOT mapContains(${column}, ${key})`;
    case 0: // Contains
    default:
      return `(mapContains(${column}, ${key}) AND positionCaseInsensitive(${column}[${key}], ${value}) > 0)`;
  }
}

const APM_ATTRIBUTE_FIELDS = ['resource_attributes', 'scope_attributes', 'log_attributes'];

// Converts the columnar otel_logs frame to row records shaped like apmlog.get
// results, parsing the JSON-encoded attribute map columns into objects
export function handleClickHouseLogsResponse(frames: Array<DataFrameJSON | null> | null): any[] {
  const records: any[] = [];

  for (const frameJSON of frames || []) {
    if (!frameJSON?.schema?.fields || !frameJSON?.data?.values) {
      continue;
    }

    const fieldNames = frameJSON.schema.fields.map((f) => f.name);
    const columns = frameJSON.data.values;
    const rowCount = columns[0]?.length || 0;

    for (let i = 0; i < rowCount; i++) {
      const record: Record<string, any> = {};
      for (let f = 0; f < fieldNames.length; f++) {
        record[fieldNames[f]] = columns[f]?.[i];
      }
      for (const field of APM_ATTRIBUTE_FIELDS) {
        if (typeof record[field] === 'string') {
          try {
            record[field] = JSON.parse(record[field]);
          } catch {
            record[field] = {};
          }
        }
      }
      records.push(record);
    }
  }

  return records;
}

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
