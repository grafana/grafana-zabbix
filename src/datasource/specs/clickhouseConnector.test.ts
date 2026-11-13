import { DataSourceApi, PluginType } from '@grafana/data';
import { compactQuery } from '../utils';
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
});
