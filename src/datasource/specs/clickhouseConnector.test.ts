import { DataSourceApi, PluginType } from '@grafana/data';
import { compactQuery } from '../utils';
import {
  ClickHouseConnector,
  handleClickHouseLogsResponse,
  handleClickHouseResponse,
} from '../zabbix/connectors/clickhouse/clickhouseConnector';

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

  describe('When building APM logs query', () => {
    it('should select apmlog.get-shaped columns from otel_logs with the time range and limit', () => {
      const query = compactQuery(ctx.connector.buildAPMLogsQuery({ options: { limit: 500 } }, 15000, 15100));
      expect(query).toContain('toUnixTimestamp64Nano(Timestamp) AS timestamp');
      expect(query).toContain('toJSONString(ResourceAttributes) AS resource_attributes');
      expect(query).toContain('FROM otel_logs');
      expect(query).toContain('Timestamp >= toDateTime64(15000, 9) AND Timestamp <= toDateTime64(15100, 9)');
      expect(query).toContain('ORDER BY Timestamp DESC LIMIT 500');
    });

    it('should apply the default limit when the target sets none', () => {
      const query = ctx.connector.buildAPMLogsQuery({}, 15000, 15100);
      expect(query).toContain('LIMIT 1000');
    });

    it('should filter by service, trace ID, min severity and body', () => {
      const target = {
        apmFilter: { service: 'checkout', traceId: 'abc123', minSeverity: 13 },
        textFilter: 'timeout',
      };
      const query = ctx.connector.buildAPMLogsQuery(target, 15000, 15100);
      expect(query).toContain("ServiceName = 'checkout'");
      expect(query).toContain("TraceId = 'abc123'");
      expect(query).toContain('SeverityNumber >= 13');
      expect(query).toContain("positionCaseInsensitive(Body, 'timeout') > 0");
    });

    it('should build attribute conditions per scope and operator', () => {
      const target = {
        apmFilter: {
          attributes: [
            { scope: 'resource', key: 'env', value: 'dev', operator: 0 },
            { scope: 'scope', key: 'lib', value: 'otel', operator: 1 },
            { scope: 'log', key: 'tenant', value: 'acme', operator: 2 },
            { scope: 'log', key: 'code', value: '500', operator: 3 },
            { scope: 'log', key: 'user', value: '', operator: 4 },
            { scope: 'log', key: 'debug', value: '', operator: 5 },
            { scope: 'log', key: '', value: 'skipped: no key', operator: 0 },
          ],
        },
      };
      const query = ctx.connector.buildAPMLogsQuery(target, 15000, 15100);
      expect(query).toContain(
        "(mapContains(ResourceAttributes, 'env') AND positionCaseInsensitive(ResourceAttributes['env'], 'dev') > 0)"
      );
      expect(query).toContain("(mapContains(ScopeAttributes, 'lib') AND ScopeAttributes['lib'] = 'otel')");
      expect(query).toContain(
        "(NOT mapContains(LogAttributes, 'tenant') OR positionCaseInsensitive(LogAttributes['tenant'], 'acme') = 0)"
      );
      expect(query).toContain("(NOT mapContains(LogAttributes, 'code') OR LogAttributes['code'] != '500')");
      expect(query).toContain("mapContains(LogAttributes, 'user')");
      expect(query).toContain("NOT mapContains(LogAttributes, 'debug')");
      expect(query).not.toContain('skipped: no key');
    });

    it('should escape quotes and backslashes in filter values', () => {
      const target = {
        apmFilter: { service: "o'brien" },
        textFilter: 'C:\\temp',
      };
      const query = ctx.connector.buildAPMLogsQuery(target, 15000, 15100);
      expect(query).toContain("ServiceName = 'o\\'brien'");
      expect(query).toContain("positionCaseInsensitive(Body, 'C:\\\\temp') > 0");
    });
  });

  describe('getAPMLogs', () => {
    it('should convert the columnar response to apmlog.get-shaped records', async () => {
      ctx.connector.invokeClickHouseQuery = jest.fn().mockResolvedValue([
        {
          schema: {
            fields: [
              { name: 'timestamp' },
              { name: 'body' },
              { name: 'severity_number' },
              { name: 'service_name' },
              { name: 'resource_attributes' },
              { name: 'log_attributes' },
            ],
          },
          data: {
            values: [
              [1700000001000000000, 1700000000000000000],
              ['second line', 'first line'],
              [17, 9],
              ['checkout', 'payments'],
              ['{"service.name":"checkout"}', '{}'],
              ['not json', '{"tenant":"acme"}'],
            ],
          },
        },
      ]);

      const records = await ctx.connector.getAPMLogs({ apmFilter: { service: 'checkout' } }, 15000, 15100);

      expect(ctx.connector.invokeClickHouseQuery).toHaveBeenCalledWith(expect.stringContaining('FROM otel_logs'));
      expect(records).toEqual([
        {
          timestamp: 1700000001000000000,
          body: 'second line',
          severity_number: 17,
          service_name: 'checkout',
          resource_attributes: { 'service.name': 'checkout' },
          log_attributes: {},
        },
        {
          timestamp: 1700000000000000000,
          body: 'first line',
          severity_number: 9,
          service_name: 'payments',
          resource_attributes: {},
          log_attributes: { tenant: 'acme' },
        },
      ]);
    });

    it('should handle empty and malformed responses', async () => {
      ctx.connector.invokeClickHouseQuery = jest.fn().mockResolvedValue(null);
      expect(await ctx.connector.getAPMLogs({}, 15000, 15100)).toEqual([]);

      expect(handleClickHouseLogsResponse(null)).toEqual([]);
      expect(handleClickHouseLogsResponse([null])).toEqual([]);
      expect(handleClickHouseLogsResponse([{ schema: { fields: [] }, data: { values: [] } } as any])).toEqual([]);
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
});
