import { ApmMetricAttributeFilter, ApmMetricAttributeScope } from '../../../types/query';

/**
 * SQL for reading APM (OpenTelemetry) metrics straight from the Zabbix 8.0 telemetry
 * tables in ClickHouse. Unlike apmmetric.get, ClickHouse can downsample: every query
 * returns at most one data point per series and interval, shaped like a raw data point
 * so the plugin backend converts it the same way as points read through the API.
 */

// Data point type (as in apmmetric.get) -> telemetry table
export const APM_METRIC_TABLES = [
  { type: 0, table: 'otel_metrics_gauge' },
  { type: 1, table: 'otel_metrics_sum' },
  { type: 2, table: 'otel_metrics_histogram' },
  { type: 3, table: 'otel_metrics_exponential_histogram' },
];

const ATTRIBUTE_COLUMNS: Record<ApmMetricAttributeScope, string> = {
  metric: 'Attributes',
  resource: 'ResourceAttributes',
  scope: 'ScopeAttributes',
};

// Attribute filter operators of apmmetric.get
const OP_CONTAINS = 0;
const OP_EQUALS = 1;
const OP_NOT_CONTAINS = 2;
const OP_NOT_EQUALS = 3;
const OP_EXISTS = 4;
const OP_NOT_EXISTS = 5;

// AggregationTemporality of delta metrics: the points of an interval add up.
// Cumulative metrics keep the last point of the interval.
const DELTA = 1;

export interface ApmMetricPointsQueryOptions {
  services: string[];
  metrics: string[];
  attributes?: ApmMetricAttributeFilter[];
  // Unix seconds, both inclusive
  timeFrom: number;
  timeTill: number;
  intervalSec: number;
  limit: number;
}

/** Quote a value as a ClickHouse string literal. */
export function quoteString(value: string): string {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function quoteList(values: string[]): string {
  return values.map(quoteString).join(', ');
}

function toSeconds(value: number): number {
  const seconds = Math.floor(Number(value));
  if (!Number.isFinite(seconds)) {
    throw new Error(`Invalid time value: ${value}`);
  }
  return seconds;
}

/**
 * Conditions for attribute filters, with the semantics of the Zabbix API: conditions
 * on the same attribute and operator are alternatives, everything else must match.
 */
export function buildAttributeConditions(filters: ApmMetricAttributeFilter[] = []): string[] {
  const grouped = new Map<string, { column: string; key: string; operators: Map<number, string[]> }>();
  for (const filter of filters) {
    if (!filter.key || !filter.key.trim()) {
      continue;
    }
    let operator = Number(filter.operator);
    const value = filter.value ?? '';
    if (operator === OP_CONTAINS && value === '') {
      operator = OP_EXISTS;
    }
    const column = ATTRIBUTE_COLUMNS[filter.scope] ?? ATTRIBUTE_COLUMNS.metric;
    const groupKey = `${column}\u0000${filter.key}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, { column, key: filter.key, operators: new Map() });
    }
    const operators = grouped.get(groupKey).operators;
    operators.set(operator, [...(operators.get(operator) ?? []), value]);
  }

  const conditions: string[] = [];
  for (const { column, key, operators } of grouped.values()) {
    if (operators.has(OP_EXISTS) && operators.has(OP_NOT_EXISTS)) {
      continue;
    }
    if (operators.has(OP_EQUALS) || operators.has(OP_CONTAINS)) {
      operators.delete(OP_EXISTS);
    }
    if (operators.has(OP_NOT_EQUALS) || operators.has(OP_NOT_CONTAINS)) {
      operators.delete(OP_NOT_EXISTS);
    }

    const k = quoteString(key);
    const field = `${column}[${k}]`;
    const anyOf: string[] = [];
    const allOf: string[] = [];

    if (operators.has(OP_EQUALS)) {
      anyOf.push(`(mapContains(${column}, ${k}) AND ${field} IN (${quoteList(operators.get(OP_EQUALS))}))`);
    }
    for (const value of operators.get(OP_CONTAINS) ?? []) {
      anyOf.push(`positionCaseInsensitive(${field}, ${quoteString(value)}) > 0`);
    }
    if (operators.has(OP_EXISTS)) {
      anyOf.push(`mapContains(${column}, ${k})`);
    }
    if (operators.has(OP_NOT_EXISTS)) {
      anyOf.push(`NOT mapContains(${column}, ${k})`);
    }
    if (operators.has(OP_NOT_EQUALS)) {
      allOf.push(`(NOT mapContains(${column}, ${k}) OR ${field} NOT IN (${quoteList(operators.get(OP_NOT_EQUALS))}))`);
    }
    for (const value of operators.get(OP_NOT_CONTAINS) ?? []) {
      allOf.push(`positionCaseInsensitive(${field}, ${quoteString(value)}) = 0`);
    }

    if (anyOf.length > 0) {
      allOf.unshift(anyOf.length === 1 ? anyOf[0] : `(${anyOf.join(' OR ')})`);
    }
    if (allOf.length > 0) {
      conditions.push(allOf.join(' AND '));
    }
  }
  return conditions;
}

function buildWhere(
  timeFrom: number,
  timeTill: number,
  services: string[],
  metrics: string[],
  attributes?: ApmMetricAttributeFilter[]
): string {
  const conditions = [
    `TimeUnix >= toDateTime64(${toSeconds(timeFrom)}, 9)`,
    `TimeUnix < toDateTime64(${toSeconds(timeTill) + 1}, 9)`,
  ];
  if (metrics.length > 0) {
    conditions.push(`MetricName IN (${quoteList(metrics)})`);
  }
  if (services.length > 0) {
    conditions.push(`ServiceName IN (${quoteList(services)})`);
  }
  conditions.push(...buildAttributeConditions(attributes));
  return conditions.join(' AND ');
}

// last(x): the value of the newest point of the interval
const last = (column: string) => `argMax(${column}, TimeUnix)`;
// Delta metrics add up over the interval, cumulative metrics keep their last value
const lastOrSum = (column: string, sum = `sum(${column})`) =>
  `if(AggregationTemporality = ${DELTA}, ${sum}, ${last(column)})`;
const floats = (expr: string) => `arrayMap(x -> toFloat64(x), ${expr})`;

/**
 * Per-type parts of the downsampling query: the aggregated columns of a data point
 * and the columns that, besides the series identity, must not be mixed in one point.
 */
const POINT_COLUMNS: Record<number, { groupBy: string[]; select: string[] }> = {
  // Gauge: average of the interval
  0: {
    groupBy: [],
    select: [`avg(Value) AS value`],
  },
  // Sum
  1: {
    groupBy: ['AggregationTemporality', 'IsMonotonic'],
    select: [
      `${lastOrSum('Value')} AS value`,
      `toUnixTimestamp64Nano(${lastOrSum('StartTimeUnix', 'min(StartTimeUnix)')}) AS start_time_unix`,
      `AggregationTemporality AS aggregation_temporality`,
      `IsMonotonic AS is_monotonic`,
    ],
  },
  // Histogram
  2: {
    groupBy: ['AggregationTemporality', 'ExplicitBounds'],
    select: [
      `toUnixTimestamp64Nano(${lastOrSum('StartTimeUnix', 'min(StartTimeUnix)')}) AS start_time_unix`,
      `AggregationTemporality AS aggregation_temporality`,
      `toFloat64(${lastOrSum('Count')}) AS count`,
      `${lastOrSum('Sum')} AS sum`,
      `${floats(lastOrSum('BucketCounts', 'sumForEach(BucketCounts)'))} AS bucket_counts`,
      `ExplicitBounds AS explicit_bounds`,
    ],
  },
  // Exponential histogram. Bucket arrays can only be added up when they have the same
  // layout, so points with a different scale or offset stay separate.
  3: {
    groupBy: [
      'AggregationTemporality',
      'Scale',
      'PositiveOffset',
      'NegativeOffset',
      'length(PositiveBucketCounts)',
      'length(NegativeBucketCounts)',
    ],
    select: [
      `toUnixTimestamp64Nano(${lastOrSum('StartTimeUnix', 'min(StartTimeUnix)')}) AS start_time_unix`,
      `AggregationTemporality AS aggregation_temporality`,
      `toFloat64(${lastOrSum('Count')}) AS count`,
      `${lastOrSum('Sum')} AS sum`,
      `Scale AS scale`,
      `toFloat64(${lastOrSum('ZeroCount')}) AS zero_count`,
      `PositiveOffset AS positive_offset`,
      `${floats(lastOrSum('PositiveBucketCounts', 'sumForEach(PositiveBucketCounts)'))} AS positive_bucket_counts`,
      `NegativeOffset AS negative_offset`,
      `${floats(lastOrSum('NegativeBucketCounts', 'sumForEach(NegativeBucketCounts)'))} AS negative_bucket_counts`,
    ],
  },
};

const SERIES_COLUMNS = ['ServiceName', 'MetricName', 'MetricUnit', 'ScopeName', 'ResourceAttributes', 'Attributes'];

/**
 * Query returning the newest data points first, one JSON object per row in the `point`
 * column, with the property names of the apmmetric.get API.
 */
export function buildApmMetricPointsQuery(options: ApmMetricPointsQueryOptions): string {
  const intervalSec = Math.max(1, Math.floor(options.intervalSec) || 1);
  const limit = Math.max(1, Math.floor(options.limit) || 1);
  const where = buildWhere(options.timeFrom, options.timeTill, options.services, options.metrics, options.attributes);

  const subQueries = APM_METRIC_TABLES.map(({ type, table }) => {
    const { groupBy, select } = POINT_COLUMNS[type];
    const pointColumns = [
      'type',
      'service_name',
      'metric_name',
      'metric_unit',
      'scope_name',
      'resource_attributes',
      'attributes',
      'time_unix',
      ...select.map((column) => column.substring(column.lastIndexOf(' AS ') + 4)),
    ];
    return `
      SELECT time_unix, formatRowNoNewline('JSONEachRow', ${pointColumns.join(', ')}) AS point
      FROM (
        SELECT
          ${type} AS type,
          ServiceName AS service_name,
          MetricName AS metric_name,
          MetricUnit AS metric_unit,
          ScopeName AS scope_name,
          ResourceAttributes AS resource_attributes,
          Attributes AS attributes,
          toUnixTimestamp64Nano(max(TimeUnix)) AS time_unix,
          ${select.join(',\n          ')}
        FROM ${table}
        WHERE ${where} AND bitAnd(Flags, 1) = 0
        GROUP BY ${[...SERIES_COLUMNS, ...groupBy].join(', ')}, intDiv(toUnixTimestamp(TimeUnix), ${intervalSec})
        ORDER BY time_unix DESC
        LIMIT ${limit}
      )`;
  });

  return `
    SELECT point
    FROM (${subQueries.join('\n      UNION ALL')}
    )
    ORDER BY time_unix DESC
    LIMIT ${limit}
    SETTINGS output_format_json_quote_64bit_integers = 0
  `;
}

/** Distinct services and metrics (with type and unit) that have data in the time range. */
export function buildApmMetricCatalogQuery(timeFrom: number, timeTill: number, services: string[], limit: number) {
  const where = buildWhere(timeFrom, timeTill, services, []);
  const subQueries = APM_METRIC_TABLES.map(
    ({ type, table }) => `
      SELECT DISTINCT ${type} AS type, toString(ServiceName) AS service_name, MetricName AS metric_name, MetricUnit AS metric_unit
      FROM ${table}
      WHERE ${where}`
  );
  return `
    SELECT type, service_name, metric_name, metric_unit
    FROM (${subQueries.join('\n      UNION ALL')}
    )
    ORDER BY metric_name, service_name
    LIMIT ${Math.max(1, Math.floor(limit))}
  `;
}

/** Distinct attribute sets of a metric in the time range, as JSON objects. */
export function buildApmMetricAttributesQuery(
  timeFrom: number,
  timeTill: number,
  metrics: string[],
  services: string[],
  limit: number
) {
  const where = buildWhere(timeFrom, timeTill, services, metrics);
  const subQueries = APM_METRIC_TABLES.map(
    ({ table }) => `
      SELECT DISTINCT toJSONString(Attributes) AS attributes, toJSONString(ResourceAttributes) AS resource_attributes
      FROM ${table}
      WHERE ${where}`
  );
  return `
    SELECT DISTINCT attributes, resource_attributes
    FROM (${subQueries.join('\n      UNION ALL')}
    )
    LIMIT ${Math.max(1, Math.floor(limit))}
  `;
}

/** Counts the telemetry tables present in the database of the ClickHouse data source. */
export function buildApmMetricTablesQuery() {
  return `
    SELECT count() AS tables
    FROM system.tables
    WHERE database = currentDatabase() AND name IN (${quoteList(APM_METRIC_TABLES.map((t) => t.table))})
  `;
}
