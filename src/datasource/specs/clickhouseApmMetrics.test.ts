import { DataSourceApi } from '@grafana/data';
import {
  buildApmMetricAttributesQuery,
  buildApmMetricCatalogQuery,
  buildApmMetricPointsQuery,
  buildApmMetricTablesQuery,
  buildAttributeConditions,
  quoteString,
} from '../zabbix/connectors/clickhouse/apmMetrics';
import { ClickHouseConnector } from '../zabbix/connectors/clickhouse/clickhouseConnector';

jest.mock(
  '@grafana/runtime',
  () => ({
    getBackendSrv: () => ({ datasourceRequest: jest.fn() }),
  }),
  { virtual: true }
);

const compact = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('ClickHouse APM metrics SQL', () => {
  describe('quoteString()', () => {
    it('escapes quotes and backslashes so values cannot break out of the literal', () => {
      expect(quoteString('checkout')).toBe("'checkout'");
      expect(quoteString("o'brien")).toBe("'o\\'brien'");
      expect(quoteString("x\\' OR 1=1 --")).toBe("'x\\\\\\' OR 1=1 --'");
    });
  });

  describe('buildAttributeConditions()', () => {
    it('maps scopes to columns and operators to conditions', () => {
      const conditions = buildAttributeConditions([
        { scope: 'metric', key: 'http.route', value: '/pay', operator: 1 },
        { scope: 'resource', key: 'host.name', value: 'web', operator: 0 },
        { scope: 'scope', key: 'lib', value: '', operator: 4 },
        { scope: 'metric', key: 'debug', value: '', operator: 5 },
        { scope: 'metric', key: 'status', value: '500', operator: 3 },
        { scope: 'metric', key: 'path', value: 'health', operator: 2 },
      ]);

      expect(conditions).toEqual([
        "(mapContains(Attributes, 'http.route') AND Attributes['http.route'] IN ('/pay'))",
        "positionCaseInsensitive(ResourceAttributes['host.name'], 'web') > 0",
        "mapContains(ScopeAttributes, 'lib')",
        "NOT mapContains(Attributes, 'debug')",
        "(NOT mapContains(Attributes, 'status') OR Attributes['status'] NOT IN ('500'))",
        "positionCaseInsensitive(Attributes['path'], 'health') = 0",
      ]);
    });

    it('treats conditions on the same attribute and operator as alternatives, like the Zabbix API', () => {
      const conditions = buildAttributeConditions([
        { scope: 'metric', key: 'http.route', value: '/pay', operator: 1 },
        { scope: 'metric', key: 'http.route', value: '/cart', operator: 1 },
      ]);
      expect(conditions).toEqual([
        "(mapContains(Attributes, 'http.route') AND Attributes['http.route'] IN ('/pay', '/cart'))",
      ]);
    });

    it('reads an empty Contains as Exists and skips conditions without a key', () => {
      expect(
        buildAttributeConditions([
          { scope: 'metric', key: 'http.route', value: '', operator: 0 },
          { scope: 'metric', key: ' ', value: 'x', operator: 1 },
        ])
      ).toEqual(["mapContains(Attributes, 'http.route')"]);
    });

    it('drops contradicting Exists and Does not exist conditions on one attribute', () => {
      expect(
        buildAttributeConditions([
          { scope: 'metric', key: 'a', value: '', operator: 4 },
          { scope: 'metric', key: 'a', value: '', operator: 5 },
        ])
      ).toEqual([]);
    });

    it('quotes keys and values', () => {
      const [condition] = buildAttributeConditions([{ scope: 'metric', key: "k'", value: "v'", operator: 1 }]);
      expect(condition).toBe("(mapContains(Attributes, 'k\\'') AND Attributes['k\\''] IN ('v\\''))");
    });
  });

  describe('buildApmMetricPointsQuery()', () => {
    const query = compact(
      buildApmMetricPointsQuery({
        services: ['checkout'],
        metrics: ['http.server.request.count', "it's"],
        attributes: [{ scope: 'metric', key: 'http.route', value: '/pay', operator: 1 }],
        timeFrom: 1000,
        timeTill: 2000,
        intervalSec: 60,
        limit: 500,
      })
    );

    it('reads all four telemetry tables, newest points first, up to the limit', () => {
      for (const table of [
        'otel_metrics_gauge',
        'otel_metrics_sum',
        'otel_metrics_histogram',
        'otel_metrics_exponential_histogram',
      ]) {
        expect(query).toContain(`FROM ${table} WHERE`);
      }
      expect(query.match(/UNION ALL/g)).toHaveLength(3);
      expect(query).toMatch(
        /\) ORDER BY time_unix DESC LIMIT 500 SETTINGS output_format_json_quote_64bit_integers = 0$/
      );
    });

    it('filters by time range, metric, service, attributes and recorded values', () => {
      expect(query).toContain(
        'WHERE TimeUnix >= toDateTime64(1000, 9) AND TimeUnix < toDateTime64(2001, 9) ' +
          "AND MetricName IN ('http.server.request.count', 'it\\'s') AND ServiceName IN ('checkout') " +
          "AND (mapContains(Attributes, 'http.route') AND Attributes['http.route'] IN ('/pay')) " +
          'AND bitAnd(Flags, 1) = 0'
      );
    });

    it('downsamples every series to the interval', () => {
      expect(query).toContain(
        'GROUP BY ServiceName, MetricName, MetricUnit, ScopeName, ResourceAttributes, Attributes, ' +
          'intDiv(toUnixTimestamp(TimeUnix), 60)'
      );
      // Gauges are averaged
      expect(query).toContain('avg(Value) AS value');
      // Delta sums add up, cumulative sums keep the last value of the interval
      expect(query).toContain('if(AggregationTemporality = 1, sum(Value), argMax(Value, TimeUnix)) AS value');
      expect(query).toContain(
        'if(AggregationTemporality = 1, sumForEach(BucketCounts), argMax(BucketCounts, TimeUnix))'
      );
      // Exponential histograms with a different layout are not mixed
      expect(query).toContain('Scale, PositiveOffset, NegativeOffset, length(PositiveBucketCounts)');
    });

    it('returns each point as a JSON object with the property names of the API', () => {
      expect(query).toContain(
        "formatRowNoNewline('JSONEachRow', type, service_name, metric_name, metric_unit, scope_name, " +
          'resource_attributes, attributes, time_unix, value, start_time_unix, aggregation_temporality, is_monotonic) AS point'
      );
      expect(query).toContain('positive_bucket_counts, negative_offset, negative_bucket_counts) AS point');
    });

    it('rejects a time range that is not numeric', () => {
      expect(() =>
        buildApmMetricPointsQuery({
          services: [],
          metrics: ['m'],
          timeFrom: '0); DROP TABLE x --' as any,
          timeTill: 10,
          intervalSec: 60,
          limit: 1,
        })
      ).toThrow('Invalid time value');
    });

    it('clamps the interval and the limit to positive integers', () => {
      const sql = compact(
        buildApmMetricPointsQuery({ services: [], metrics: ['m'], timeFrom: 0, timeTill: 10, intervalSec: 0, limit: 0 })
      );
      expect(sql).toContain('intDiv(toUnixTimestamp(TimeUnix), 1)');
      expect(sql).toContain('LIMIT 1 SETTINGS');
      expect(sql).not.toContain('ServiceName IN');
    });
  });

  it('buildApmMetricCatalogQuery() lists distinct services and metrics with their type', () => {
    const query = compact(buildApmMetricCatalogQuery(1000, 2000, ['checkout'], 100));
    expect(query).toContain(
      'SELECT DISTINCT 2 AS type, toString(ServiceName) AS service_name, MetricName AS metric_name, MetricUnit AS metric_unit FROM otel_metrics_histogram'
    );
    expect(query).toContain("ServiceName IN ('checkout')");
    expect(query).toMatch(/LIMIT 100$/);
  });

  it('buildApmMetricAttributesQuery() lists the distinct attribute sets of a metric', () => {
    const query = compact(buildApmMetricAttributesQuery(1000, 2000, ['m'], [], 50));
    expect(query).toContain(
      'SELECT DISTINCT toJSONString(Attributes) AS attributes, toJSONString(ResourceAttributes) AS resource_attributes FROM otel_metrics_sum'
    );
    expect(query).toContain("MetricName IN ('m')");
    expect(query).toMatch(/LIMIT 50$/);
  });

  it('buildApmMetricTablesQuery() counts the telemetry tables of the current database', () => {
    expect(compact(buildApmMetricTablesQuery())).toBe(
      'SELECT count() AS tables FROM system.tables WHERE database = currentDatabase() AND name IN ' +
        "('otel_metrics_gauge', 'otel_metrics_sum', 'otel_metrics_histogram', 'otel_metrics_exponential_histogram')"
    );
  });
});

describe('ClickHouseConnector APM metrics', () => {
  const frame = (columns: Record<string, any[]>) => ({
    schema: { fields: Object.keys(columns).map((name) => ({ name })) },
    data: { values: Object.values(columns) },
  });
  let connector: ClickHouseConnector;
  let invoke: jest.Mock;

  beforeEach(() => {
    connector = new ClickHouseConnector({ type: 'grafana-clickhouse-datasource', uid: 'ch' } as DataSourceApi, {});
    invoke = jest.fn();
    connector.invokeClickHouseQuery = invoke;
  });

  it('hasApmMetricTables() is true only when all four telemetry tables exist', async () => {
    invoke.mockResolvedValueOnce([frame({ tables: [4] })]);
    expect(await connector.hasApmMetricTables()).toBe(true);

    invoke.mockResolvedValueOnce([frame({ tables: [0] })]);
    expect(await connector.hasApmMetricTables()).toBe(false);

    invoke.mockResolvedValueOnce(null);
    expect(await connector.hasApmMetricTables()).toBe(false);
  });

  it('getApmMetricPoints() returns the JSON of each point untouched', async () => {
    const points = ['{"type":0,"time_unix":1794433025954728676,"value":1}', '{"type":0,"time_unix":1,"value":2}'];
    invoke.mockResolvedValueOnce([frame({ point: points })]);

    const result = await connector.getApmMetricPoints({
      services: [],
      metrics: ["a  b'"],
      timeFrom: 0,
      timeTill: 10,
      intervalSec: 60,
      limit: 10,
    });

    expect(result).toEqual(points);
    // The query is not whitespace-compacted: that would change quoted values
    expect(invoke.mock.calls[0][0]).toContain("MetricName IN ('a  b\\'')");
  });

  it('getApmMetricAttributeRows() parses the attribute maps', async () => {
    invoke.mockResolvedValueOnce([
      frame({ attributes: ['{"http.route":"\\/pay"}', '{}'], resource_attributes: ['{"host.name":"web-1"}', ''] }),
    ]);

    expect(await connector.getApmMetricAttributeRows(0, 10, ['m'], [], 100)).toEqual([
      { attributes: { 'http.route': '/pay' }, resource_attributes: { 'host.name': 'web-1' } },
      { attributes: {}, resource_attributes: {} },
    ]);
  });
});
