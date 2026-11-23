import { DataSourceApi, PluginType } from '@grafana/data';
import { compactQuery } from '../utils';
import {
  buildAttributeConditions,
  buildTraceSearchQuery,
  buildTraceSpansQuery,
} from '../zabbix/connectors/clickhouse/apmTraces';
import { ClickHouseConnector, handleClickHouseResponse } from '../zabbix/connectors/clickhouse/clickhouseConnector';

const datasourceRequestMock = jest.fn().mockResolvedValue({ data: { results: {} } });

jest.mock(
  '@grafana/runtime',
  () => ({
    getBackendSrv: () => ({
      datasourceRequest: datasourceRequestMock,
    }),
  }),
  { virtual: true }
);

describe('ClickHouseConnector', () => {
  let ctx: any = {};
  const datasourceMock: DataSourceApi = {
    type: 'grafana-clickhouse-datasource',
    id: 42,
    uid: 'clickhouse',
    name: 'ClickHouse DS',
    query: jest.fn().mockResolvedValue({ data: [] }),
    testDatasource: jest.fn().mockResolvedValue({ status: 'success', message: 'OK' }),
    meta: {
      id: '42',
      name: 'ClickHouse DS',
      type: PluginType.datasource,
      info: {
        author: {
          name: 'ClickHouse DS',
        },
        description: 'ClickHouse DS',
        links: [],
        logos: {
          small: 'ClickHouse DS',
          large: 'ClickHouse DS',
        },
        screenshots: [],
        updated: '2026-02-25',
        version: '1.0.0',
      },
      module: 'clickhouse',
      baseUrl: 'http://clickhouse.org',
    },
    getRef: jest.fn().mockResolvedValue({ data: [] }),
  };

  beforeEach(() => {
    ctx.connector = new ClickHouseConnector(datasourceMock, {});
    ctx.connector.invokeClickHouseQuery = jest.fn().mockResolvedValue(null);
  });

  describe('When building history query', () => {
    it('should build proper query', () => {
      const query = ctx.connector.buildHistoryQuery('123, 234', 'history', 15000, 15100, 5, 'MAX');
      const expected = compactQuery(`
        SELECT toString(itemid) AS metric, intDiv(toUnixTimestamp(toDateTime(clock_ns)), 5) * 5 AS time, MAX(value) AS value
        FROM history
        WHERE itemid IN (123, 234)
          AND clock_ns > toDateTime64(15000, 9)
          AND clock_ns < toDateTime64(15100, 9)
        GROUP BY metric, time
        ORDER BY time ASC
      `);
      expect(compactQuery(query)).toBe(expected);
    });
  });

  describe('When invoking queries', () => {
    it('should query proper table depending on item value type', () => {
      const options = { intervalMs: 5000, consolidateBy: 'avg' };
      const items = [{ itemid: '123', value_type: 3 }];
      ctx.connector.getHistory(items, 15000, 15100, options);
      expect(ctx.connector.invokeClickHouseQuery).toHaveBeenCalledWith(expect.stringContaining('FROM history_uint'));
    });

    it('should split query if different item value types are used', () => {
      const options = { intervalMs: 5000 };
      const items = [
        { itemid: '123', value_type: 0 },
        { itemid: '234', value_type: 3 },
      ];
      ctx.connector.getHistory(items, 15000, 15100, options);
      expect(ctx.connector.invokeClickHouseQuery).toHaveBeenCalledTimes(2);
      expect(ctx.connector.invokeClickHouseQuery).toHaveBeenNthCalledWith(1, expect.stringContaining('FROM history'));
      expect(ctx.connector.invokeClickHouseQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('FROM history_uint')
      );
    });

    it('should serve trends requests from history (no trends in ClickHouse)', () => {
      const options = { intervalMs: 5000, consolidateBy: 'max' };
      const items = [{ itemid: '123', value_type: 3 }];
      ctx.connector.getTrends(items, 15000, 15100, options);
      expect(ctx.connector.invokeClickHouseQuery).toHaveBeenCalledWith(expect.stringContaining('FROM history_uint'));
      expect(ctx.connector.invokeClickHouseQuery).toHaveBeenCalledWith(expect.stringContaining('MAX(value)'));
    });
  });

  describe('invokeClickHouseQuery', () => {
    it('should post a raw SQL query to the ds query endpoint', async () => {
      datasourceRequestMock.mockResolvedValue({ data: { results: { A: { frames: [] } } } });
      const connector = new ClickHouseConnector(datasourceMock, {});
      const result = await connector.invokeClickHouseQuery('SELECT 1');

      expect(datasourceRequestMock).toHaveBeenCalledWith({
        url: '/api/ds/query',
        method: 'POST',
        data: {
          queries: [
            {
              refId: 'A',
              datasource: { type: 'grafana-clickhouse-datasource', uid: 'clickhouse' },
              editorType: 'sql',
              rawSql: 'SELECT 1',
              format: 1,
              maxDataPoints: 10000,
            },
          ],
        },
      });
      expect(result).toEqual([]);
    });
  });

  describe('handleClickHouseResponse', () => {
    it('should convert long frames to per-item frames with ms timestamps', () => {
      const frames = [
        {
          schema: {
            fields: [{ name: 'metric' }, { name: 'time' }, { name: 'value' }],
          },
          data: {
            values: [
              ['123', '234', '123'],
              [15000, 15000, 15005],
              [10, 20, 30],
            ],
          },
        },
      ];

      const result: any[] = handleClickHouseResponse(frames as any);
      expect(result).toHaveLength(2);

      const first = result[0];
      expect(first.schema.fields[0].name).toBe('Time');
      expect(first.schema.fields[1].name).toBe('123');
      expect(first.data.values[0]).toEqual([15000000, 15005000]);
      expect(first.data.values[1]).toEqual([10, 30]);

      const second = result[1];
      expect(second.schema.fields[1].name).toBe('234');
      expect(second.data.values[0]).toEqual([15000000]);
      expect(second.data.values[1]).toEqual([20]);
    });

    it('should handle empty and malformed responses', () => {
      expect(handleClickHouseResponse(null as any)).toEqual([]);
      expect(handleClickHouseResponse([null])).toEqual([]);
      expect(
        handleClickHouseResponse([{ schema: { fields: [{ name: 'foo' }] }, data: { values: [[]] } } as any])
      ).toEqual([]);
    });
  });

  describe('When querying APM traces', () => {
    const range = { time_from: 10000, time_till: 20000 };

    it('should build a trace search without a span subquery when there are no filters', () => {
      const query = buildTraceSearchQuery({ ...range, limit: 50, sortorder: 'DESC' });
      // Spans are looked up one hour outside the requested range
      expect(query).toContain(
        'FROM otel_traces AS t WHERE t.Timestamp >= toDateTime64(6400, 9) AND t.Timestamp < toDateTime64(23600, 9) GROUP BY t.TraceId'
      );
      // The trace itself has to start inside the requested range
      expect(query).toContain("minIf(t.Timestamp, t.ParentSpanId = '') >= toDateTime64(10000, 9)");
      expect(query).toContain('min(t.Timestamp) < toDateTime64(20000, 9)');
      expect(query).not.toContain('t.TraceId IN');
      expect(query).toMatch(/ORDER BY argMin\(t\.Timestamp, .*\) DESC, t\.TraceId LIMIT 50$/);
    });

    it('should filter traces by the spans that match all the filters', () => {
      const query = buildTraceSearchQuery({
        ...range,
        filter: { service_name: "o'brien", status_code: 'Error' },
        search: { span_name: '50%_done' },
        min_duration: 1000000,
        max_duration: 5000000000,
        resource_attributes: [{ key: 'env', value: 'prod', operator: 1 }],
        span_attributes: [{ key: 'http.route', value: '/cart', operator: 0 }],
      });
      expect(query).toContain(
        't.TraceId IN (SELECT tf.TraceId FROM otel_traces AS tf WHERE ' +
          'tf.Timestamp >= toDateTime64(6400, 9) AND tf.Timestamp < toDateTime64(23600, 9)' +
          " AND tf.ServiceName = 'o\\'brien' AND tf.StatusCode = 'Error'" +
          " AND tf.SpanName ILIKE '%50\\\\%\\\\_done%'" +
          " AND (mapContains(tf.ResourceAttributes, 'env') AND tf.ResourceAttributes['env'] IN ('prod'))" +
          " AND positionCaseInsensitive(tf.SpanAttributes['http.route'], '/cart') > 0)"
      );
      expect(query).toContain("argMinIf(t.Duration, t.Timestamp, t.ParentSpanId = '') >= 1000000");
      expect(query).toContain("argMinIf(t.Duration, t.Timestamp, t.ParentSpanId = '') <= 5000000000");
    });

    it('should reject values that are not numbers where SQL expects one', () => {
      expect(() => buildTraceSearchQuery({ ...range, limit: '1; DROP TABLE otel_traces' })).toThrow('Invalid limit');
      expect(() => buildTraceSearchQuery({ time_from: 'now()', time_till: 1 })).toThrow('Invalid time_from');
    });

    it('should build attribute conditions like apmtrace.get does', () => {
      const conditions = buildAttributeConditions('tf.SpanAttributes', [
        // Same key: alternatives
        { key: 'a', value: 'x', operator: 1 },
        { key: 'a', value: 'y', operator: 1 },
        { key: 'a', value: 'z', operator: 0 },
        // "Contains" without a value means "exists"
        { key: 'b', value: '', operator: 0 },
        { key: 'c', value: 'n', operator: 3 },
        { key: 'c', value: 'm', operator: 2 },
        { key: 'd', value: '', operator: 5 },
        // Exists and does not exist on the same key cancel each other out
        { key: 'e', value: '', operator: 4 },
        { key: 'e', value: '', operator: 5 },
        // No key: ignored
        { key: '', value: 'ignored', operator: 1 },
      ]);
      expect(conditions).toEqual([
        "((mapContains(tf.SpanAttributes, 'a') AND tf.SpanAttributes['a'] IN ('x', 'y')) OR positionCaseInsensitive(tf.SpanAttributes['a'], 'z') > 0)",
        "mapContains(tf.SpanAttributes, 'b')",
        "(NOT mapContains(tf.SpanAttributes, 'c') OR tf.SpanAttributes['c'] NOT IN ('n')) AND positionCaseInsensitive(tf.SpanAttributes['c'], 'm') = 0",
        "NOT mapContains(tf.SpanAttributes, 'd')",
      ]);
    });

    it('should return trace search rows in the shape of apmtrace.get', async () => {
      ctx.connector.invokeClickHouseQuery = jest.fn().mockResolvedValue([
        {
          schema: {
            fields: [{ name: 'traceid' }, { name: 'timestamp' }, { name: 'duration' }, { name: 'span_count' }],
          },
          data: {
            values: [
              ['aaa', 'bbb'],
              ['1794402688211779967', '1794402688211777467'],
              [5000000000, 1200],
              [3, 1],
            ],
          },
        },
      ]);
      const traces = await ctx.connector.getApmTraces({ ...range, limit: 10 });
      expect(ctx.connector.invokeClickHouseQuery).toHaveBeenCalledWith(buildTraceSearchQuery({ ...range, limit: 10 }));
      expect(traces).toEqual([
        { traceid: 'aaa', timestamp: '1794402688211779967', duration: 5000000000, span_count: 3 },
        { traceid: 'bbb', timestamp: '1794402688211777467', duration: 1200, span_count: 1 },
      ]);
    });

    it('should return spans in the shape of apmspan.get', async () => {
      ctx.connector.invokeClickHouseQuery = jest.fn().mockResolvedValue([
        {
          schema: {
            fields: [
              { name: 'timestamp' },
              { name: 'spanid' },
              { name: 'resource_attributes' },
              { name: 'span_attributes' },
              { name: 'events' },
              { name: 'links' },
            ],
          },
          data: {
            values: [
              ['1794402688211728717'],
              ['s1'],
              ['{"service.name":"payments"}'],
              ['{}'],
              ['[["1794402688711728717","retry",{"retry.attempt":"2"}]]'],
              ['[["t2","s2","",{"link.reason":"checkout"}]]'],
            ],
          },
        },
      ]);
      const params = { time_from: 6400, time_till: 23600, traceids: ["t'1"], sortorder: 'ASC' };
      const spans = await ctx.connector.getApmSpans(params);

      const query = ctx.connector.invokeClickHouseQuery.mock.calls[0][0];
      expect(query).toBe(buildTraceSpansQuery(params));
      expect(query).toContain(
        "WHERE t.Timestamp >= toDateTime64(6400, 9) AND t.Timestamp < toDateTime64(23600, 9) AND t.TraceId IN ('t\\'1') ORDER BY t.Timestamp ASC"
      );
      expect(spans).toEqual([
        {
          timestamp: '1794402688211728717',
          spanid: 's1',
          resource_attributes: { 'service.name': 'payments' },
          span_attributes: {},
          events: [{ timestamp: '1794402688711728717', name: 'retry', attributes: { 'retry.attempt': '2' } }],
          links: [{ traceid: 't2', spanid: 's2', trace_state: '', attributes: { 'link.reason': 'checkout' } }],
        },
      ]);
    });

    it('should return no rows for an empty response', async () => {
      expect(await ctx.connector.getApmTraces(range)).toEqual([]);
      expect(await ctx.connector.getApmSpans({ ...range, traceids: ['a'] })).toEqual([]);
    });
  });
});
