import { DataFrameJSON } from '@grafana/data';
import { APM_TRACE_MAX_DURATION } from '../../../constants';

/**
 * SQL for the Zabbix 8.0 OTEL traces table in ClickHouse (otel_traces). The
 * queries take the same parameters as apmtrace.get / apmspan.get and return
 * rows in the same shape as those API methods, so both sources share one
 * response handler. The trace search mirrors the query Zabbix itself runs for
 * apmtrace.get.
 */

const TRACES_TABLE = 'otel_traces';

// Attribute filter operators of apmtrace.get
const OP_CONTAINS = 0;
const OP_EQUALS = 1;
const OP_NOT_CONTAINS = 2;
const OP_NOT_EQUALS = 3;
const OP_EXISTS = 4;
const OP_NOT_EXISTS = 5;

interface AttributeFilter {
  key: string;
  value?: string;
  operator: number;
}

export function quoteString(value: unknown): string {
  return `'${String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")}'`;
}

function toInteger(value: unknown, name: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return Math.trunc(num);
}

// Substring pattern for ILIKE with the LIKE wildcards of the value escaped
function likePattern(value: string): string {
  return quoteString(`%${value.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
}

function timeRangeCondition(alias: string, timeFrom: number, timeTill: number): string {
  return `${alias}.Timestamp >= toDateTime64(${timeFrom}, 9) AND ${alias}.Timestamp < toDateTime64(${timeTill}, 9)`;
}

/**
 * Conditions for attribute filters on a Map column. Filters on the same key
 * are alternatives, filters on different keys must all match.
 */
export function buildAttributeConditions(column: string, filters: AttributeFilter[] = []): string[] {
  const byKey = new Map<string, Map<number, string[]>>();
  for (const filter of filters) {
    if (!filter.key) {
      continue;
    }
    // "Contains" with an empty value only checks that the attribute exists
    const operator = filter.operator === OP_CONTAINS && !filter.value ? OP_EXISTS : filter.operator;
    const operators = byKey.get(filter.key) ?? new Map<number, string[]>();
    operators.set(operator, [...(operators.get(operator) ?? []), filter.value ?? '']);
    byKey.set(filter.key, operators);
  }

  const conditions: string[] = [];
  for (const [key, operators] of byKey) {
    if (operators.has(OP_EXISTS) && operators.has(OP_NOT_EXISTS)) {
      continue;
    }
    if (operators.has(OP_EQUALS) || operators.has(OP_CONTAINS)) {
      operators.delete(OP_EXISTS);
    }
    if (operators.has(OP_NOT_EQUALS) || operators.has(OP_NOT_CONTAINS)) {
      operators.delete(OP_NOT_EXISTS);
    }

    const keySql = quoteString(key);
    const valueSql = `${column}[${keySql}]`;
    const hasKey = `mapContains(${column}, ${keySql})`;
    const anyOf: string[] = [];
    const allOf: string[] = [];

    if (operators.has(OP_EQUALS)) {
      anyOf.push(`(${hasKey} AND ${valueSql} IN (${operators.get(OP_EQUALS).map(quoteString).join(', ')}))`);
    }
    for (const value of operators.get(OP_CONTAINS) ?? []) {
      anyOf.push(`positionCaseInsensitive(${valueSql}, ${quoteString(value)}) > 0`);
    }
    if (operators.has(OP_NOT_EXISTS)) {
      anyOf.push(`NOT ${hasKey}`);
    }
    if (operators.has(OP_NOT_EQUALS)) {
      allOf.push(`(NOT ${hasKey} OR ${valueSql} NOT IN (${operators.get(OP_NOT_EQUALS).map(quoteString).join(', ')}))`);
    }
    for (const value of operators.get(OP_NOT_CONTAINS) ?? []) {
      allOf.push(`positionCaseInsensitive(${valueSql}, ${quoteString(value)}) = 0`);
    }
    if (operators.has(OP_EXISTS)) {
      anyOf.push(hasKey);
    }
    if (anyOf.length > 0) {
      allOf.push(anyOf.length > 1 ? `(${anyOf.join(' OR ')})` : anyOf[0]);
    }
    if (allOf.length > 0) {
      conditions.push(allOf.join(' AND '));
    }
  }
  return conditions;
}

/**
 * Trace search (apmtrace.get): one row per trace with the fields of its root
 * span, or of its earliest span when the root span is missing.
 */
export function buildTraceSearchQuery(params: any): string {
  const timeFrom = toInteger(params.time_from, 'time_from');
  const timeTill = toInteger(params.time_till, 'time_till');
  // Spans of a matching trace may start outside the requested range
  const lookupFrom = Math.max(0, timeFrom - APM_TRACE_MAX_DURATION);
  const lookupTill = timeTill + APM_TRACE_MAX_DURATION;

  const rootFirst = `tuple(t.ParentSpanId != '', t.Timestamp)`;
  const timestampNs = 'toUnixTimestamp64Nano(t.Timestamp)';
  const traceDuration = `toUInt64(max(${timestampNs} + t.Duration) - min(${timestampNs}))`;
  const rootDuration = `argMinIf(t.Duration, t.Timestamp, t.ParentSpanId = '')`;

  const where = [timeRangeCondition('t', lookupFrom, lookupTill)];

  // A trace matches when at least one of its spans matches all the filters
  const spanConditions: string[] = [];
  if (params.filter?.service_name) {
    spanConditions.push(`tf.ServiceName = ${quoteString(params.filter.service_name)}`);
  }
  if (params.filter?.status_code) {
    spanConditions.push(`tf.StatusCode = ${quoteString(params.filter.status_code)}`);
  }
  if (params.search?.span_name) {
    spanConditions.push(`tf.SpanName ILIKE ${likePattern(params.search.span_name)}`);
  }
  spanConditions.push(...buildAttributeConditions('tf.ResourceAttributes', params.resource_attributes));
  spanConditions.push(...buildAttributeConditions('tf.SpanAttributes', params.span_attributes));
  if (spanConditions.length > 0) {
    where.push(
      `t.TraceId IN (SELECT tf.TraceId FROM ${TRACES_TABLE} AS tf WHERE ` +
        `${timeRangeCondition('tf', lookupFrom, lookupTill)} AND ${spanConditions.join(' AND ')})`
    );
  }

  const inRange = (expr: string) =>
    `${expr} >= toDateTime64(${timeFrom}, 9) AND ${expr} < toDateTime64(${timeTill}, 9)`;
  const havingRoot = [`countIf(t.ParentSpanId = '') > 0`, inRange(`minIf(t.Timestamp, t.ParentSpanId = '')`)];
  const havingNoRoot = [`countIf(t.ParentSpanId = '') = 0`, inRange('min(t.Timestamp)')];
  if (params.min_duration !== undefined && params.min_duration !== null) {
    const minDuration = toInteger(params.min_duration, 'min_duration');
    havingRoot.push(`${rootDuration} >= ${minDuration}`);
    havingNoRoot.push(`${traceDuration} >= ${minDuration}`);
  }
  if (params.max_duration !== undefined && params.max_duration !== null) {
    const maxDuration = toInteger(params.max_duration, 'max_duration');
    havingRoot.push(`${rootDuration} <= ${maxDuration}`);
    havingNoRoot.push(`${traceDuration} <= ${maxDuration}`);
  }

  const sortOrder = params.sortorder === 'ASC' ? 'ASC' : 'DESC';
  const select = [
    't.TraceId AS traceid',
    `toString(argMin(${timestampNs}, ${rootFirst})) AS timestamp`,
    `argMin(t.SpanId, ${rootFirst}) AS spanid`,
    `argMin(t.ServiceName, ${rootFirst}) AS service_name`,
    `argMin(t.SpanName, ${rootFirst}) AS span_name`,
    `argMin(t.StatusCode, ${rootFirst}) AS status_code`,
    `${traceDuration} AS duration`,
    `toUInt8(countIf(t.ParentSpanId = '') > 0) AS has_root_span`,
    'count() AS span_count',
    `countIf(t.StatusCode = 'Error') AS error_count`,
  ];

  let sql =
    `SELECT ${select.join(', ')} FROM ${TRACES_TABLE} AS t WHERE ${where.join(' AND ')} GROUP BY t.TraceId ` +
    `HAVING (${havingRoot.join(' AND ')}) OR (${havingNoRoot.join(' AND ')}) ` +
    `ORDER BY argMin(t.Timestamp, ${rootFirst}) ${sortOrder}, t.TraceId`;
  if (params.limit) {
    sql += ` LIMIT ${toInteger(params.limit, 'limit')}`;
  }
  return sql;
}

/**
 * Spans of the given traces (apmspan.get with traceids). Attribute maps,
 * events and links are serialized to JSON strings by ClickHouse, because the
 * ClickHouse data source doesn't return nested types in a stable shape.
 */
export function buildTraceSpansQuery(params: any): string {
  const timeFrom = toInteger(params.time_from, 'time_from');
  const timeTill = toInteger(params.time_till, 'time_till');
  const traceIds = (params.traceids || []).map(quoteString).join(', ');
  const sortOrder = params.sortorder === 'DESC' ? 'DESC' : 'ASC';

  const select = [
    'toString(toUnixTimestamp64Nano(t.Timestamp)) AS timestamp',
    't.TraceId AS traceid',
    't.SpanId AS spanid',
    't.ParentSpanId AS parent_spanid',
    't.TraceState AS trace_state',
    't.SpanName AS span_name',
    't.SpanKind AS span_kind',
    't.ServiceName AS service_name',
    'toJSONString(t.ResourceAttributes) AS resource_attributes',
    't.ScopeName AS scope_name',
    't.ScopeVersion AS scope_version',
    'toJSONString(t.SpanAttributes) AS span_attributes',
    't.Duration AS duration',
    't.StatusCode AS status_code',
    't.StatusMessage AS status_message',
    'toJSONString(arrayMap((ts, name, attrs) -> tuple(toString(toUnixTimestamp64Nano(ts)), name, attrs), ' +
      't.`Events.Timestamp`, t.`Events.Name`, t.`Events.Attributes`)) AS events',
    'toJSONString(arrayMap((traceid, spanid, state, attrs) -> tuple(traceid, spanid, state, attrs), ' +
      't.`Links.TraceId`, t.`Links.SpanId`, t.`Links.TraceState`, t.`Links.Attributes`)) AS links',
  ];

  return (
    `SELECT ${select.join(', ')} FROM ${TRACES_TABLE} AS t ` +
    `WHERE ${timeRangeCondition('t', timeFrom, timeTill)} AND t.TraceId IN (${traceIds}) ` +
    `ORDER BY t.Timestamp ${sortOrder}`
  );
}

/**
 * Convert the table frames of the ClickHouse data source to one object per row.
 */
export function clickHouseFramesToRows(frames: Array<DataFrameJSON | null> | null): any[] {
  const rows: any[] = [];
  for (const frame of frames || []) {
    const fields = frame?.schema?.fields;
    const values = frame?.data?.values;
    if (!fields || !values || values.length === 0) {
      continue;
    }
    const length = values[0].length;
    for (let i = 0; i < length; i++) {
      const row: any = {};
      fields.forEach((field, column) => {
        row[field.name] = values[column][i];
      });
      rows.push(row);
    }
  }
  return rows;
}

function parseJSON(value: unknown, fallback: any) {
  if (typeof value !== 'string') {
    return value ?? fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Give span rows of buildTraceSpansQuery() the shape of apmspan.get records.
 */
export function toApmSpans(rows: any[]): any[] {
  return rows.map((row) => ({
    ...row,
    resource_attributes: parseJSON(row.resource_attributes, {}),
    span_attributes: parseJSON(row.span_attributes, {}),
    events: parseJSON(row.events, []).map(([timestamp, name, attributes]) => ({ timestamp, name, attributes })),
    links: parseJSON(row.links, []).map(([traceid, spanid, trace_state, attributes]) => ({
      traceid,
      spanid,
      trace_state,
      attributes,
    })),
  }));
}
