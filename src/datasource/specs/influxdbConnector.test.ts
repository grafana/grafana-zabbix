import { DataSourceApi, PluginType } from '@grafana/data';
import { of } from 'rxjs';
import { compactQuery } from '../utils';
import { InfluxDBConnector } from '../zabbix/connectors/influxdb/influxdbConnector';

describe('InfluxDBConnector', () => {
  let ctx: any = {};
  const datasourceMock: DataSourceApi = {
    type: 'influxdb',
    id: 42,
    uid: 'influxdb',
    name: 'InfluxDB DS',
    query: jest.fn().mockResolvedValue({ data: [] }),
    testDatasource: jest.fn().mockResolvedValue({ data: [] }),
    meta: {
      id: '42',
      name: 'InfluxDB DS',
      type: PluginType.datasource,
      info: {
        author: {
          name: 'InfluxDB DS',
        },
        description: 'InfluxDB DS',
        links: [],
        logos: {
          small: 'InfluxDB DS',
          large: 'InfluxDB DS',
        },
        screenshots: [],
        updated: '2026-02-25',
        version: '1.0.0',
      },
      module: 'influxdb',
      baseUrl: 'http://influxdb.org',
    },
    getRef: jest.fn().mockResolvedValue({ data: [] }),
  };

  beforeEach(() => {
    ctx.options = { retentionPolicy: 'longterm' };
    ctx.influxDBConnector = new InfluxDBConnector(datasourceMock, ctx.options);
    ctx.influxDBConnector.invokeInfluxDBQuery = jest.fn().mockResolvedValue([]);
    ctx.defaultQueryParams = {
      itemids: ['123', '234'],
      range: { timeFrom: 15000, timeTill: 15100 },
      intervalSec: 5,
      table: 'history',
      aggFunction: 'MAX',
    };
  });

  describe('When building InfluxDB query', () => {
    it('should build proper query', () => {
      const { itemids, range, intervalSec, table, aggFunction } = ctx.defaultQueryParams;
      const query = ctx.influxDBConnector.buildHistoryQuery(itemids, table, range, intervalSec, aggFunction);
      const expected = compactQuery(`SELECT MAX("value")
                                     FROM "history"
                                     WHERE ("itemid" = '123' OR "itemid" = '234')
                                       AND "time" >= 15000s
                                       AND "time" <= 15100s
                                     GROUP BY time(5s), "itemid" fill(none)
      `);
      expect(query).toBe(expected);
    });

    it('should use MEAN instead of AVG', () => {
      const { itemids, range, intervalSec, table } = ctx.defaultQueryParams;
      const aggFunction = 'avg';
      const query = ctx.influxDBConnector.buildHistoryQuery(itemids, table, range, intervalSec, aggFunction);
      const expected = compactQuery(`SELECT MEAN("value")
                                     FROM "history"
                                     WHERE ("itemid" = '123' OR "itemid" = '234')
                                       AND "time" >= 15000s
                                       AND "time" <= 15100s
                                     GROUP BY time(5s), "itemid" fill(none)
      `);
      expect(query).toBe(expected);
    });
  });

  describe('When invoking InfluxDB query', () => {
    it('should query proper table depending on item type', () => {
      const { timeFrom, timeTill } = ctx.defaultQueryParams.range;
      const options = { intervalMs: 5000 };
      const items = [{ itemid: '123', value_type: 3 }];
      const expectedQuery = compactQuery(`SELECT MEAN("value")
                                          FROM "history_uint"
                                          WHERE ("itemid" = '123')
                                            AND "time" >= 15000s
                                            AND "time" <= 15100s
                                          GROUP BY time(5s), "itemid" fill(none)
      `);
      ctx.influxDBConnector.getHistory(items, timeFrom, timeTill, options);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenCalledWith(expectedQuery);
    });

    it('should split query if different item types are used', () => {
      const { timeFrom, timeTill } = ctx.defaultQueryParams.range;
      const options = { intervalMs: 5000 };
      const items = [
        { itemid: '123', value_type: 0 },
        { itemid: '234', value_type: 3 },
      ];
      const sharedQueryPart = `AND "time" >= 15000s AND "time" <= 15100s GROUP BY time(5s), "itemid" fill(none)`;
      const expectedQueryFirst = compactQuery(`SELECT MEAN("value")
                                               FROM "history"
                                               WHERE ("itemid" = '123') ${sharedQueryPart}
      `);
      const expectedQuerySecond = compactQuery(`SELECT MEAN("value")
                                                FROM "history_uint"
                                                WHERE ("itemid" = '234') ${sharedQueryPart}
      `);
      ctx.influxDBConnector.getHistory(items, timeFrom, timeTill, options);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenCalledTimes(2);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenNthCalledWith(1, expectedQueryFirst);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenNthCalledWith(2, expectedQuerySecond);
    });

    it('should use the same table for trends query if no retention policy set', () => {
      ctx.influxDBConnector.retentionPolicy = '';
      const { timeFrom, timeTill } = ctx.defaultQueryParams.range;
      const options = { intervalMs: 5000 };
      const items = [{ itemid: '123', value_type: 3 }];
      const expectedQuery = compactQuery(`SELECT MEAN("value")
                                          FROM "history_uint"
                                          WHERE ("itemid" = '123')
                                            AND "time" >= 15000s
                                            AND "time" <= 15100s
                                          GROUP BY time(5s), "itemid" fill(none)
      `);
      ctx.influxDBConnector.getTrends(items, timeFrom, timeTill, options);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenCalledWith(expectedQuery);
    });

    it('should use retention policy name for trends query if it was set', () => {
      const { timeFrom, timeTill } = ctx.defaultQueryParams.range;
      const options = { intervalMs: 5000 };
      const items = [{ itemid: '123', value_type: 3 }];
      const expectedQuery = compactQuery(`SELECT MEAN("value_avg")
                                          FROM "longterm"."history_uint"
                                          WHERE ("itemid" = '123')
                                            AND "time" >= 15000s
                                            AND "time" <= 15100s
                                          GROUP BY time(5s), "itemid" fill(none)
      `);
      ctx.influxDBConnector.getTrends(items, timeFrom, timeTill, options);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenCalledWith(expectedQuery);
    });

    it('should use proper value column if retention policy set (trends used)', () => {
      const { timeFrom, timeTill } = ctx.defaultQueryParams.range;
      const options = { intervalMs: 5000, consolidateBy: 'max' };
      const items = [{ itemid: '123', value_type: 3 }];
      const expectedQuery = compactQuery(`SELECT MAX("value_max")
                                          FROM "longterm"."history_uint"
                                          WHERE ("itemid" = '123')
                                            AND "time" >= 15000s
                                            AND "time" <= 15100s
                                          GROUP BY time(5s), "itemid" fill(none)
      `);
      ctx.influxDBConnector.getTrends(items, timeFrom, timeTill, options);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenCalledWith(expectedQuery);
    });
  });

  describe('invokeInfluxDBQuery', () => {
    it('calls datasource.query and returns data.data (Observable from query)', async () => {
      const queryResult = [{ series: [{ name: 'history_uint', columns: ['time', 'value'], values: [] }] }];
      const queryMock = jest.fn().mockReturnValue(of({ data: queryResult }));
      const dsMock: any = {
        ...datasourceMock,
        query: queryMock,
      };
      const connector = new InfluxDBConnector(dsMock, { retentionPolicy: 'longterm' });

      const result = await connector.invokeInfluxDBQuery('SELECT MEAN("value") FROM "history_uint"');

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock).toHaveBeenCalledWith('SELECT MEAN("value") FROM "history_uint"');
      expect(result).toEqual(queryResult);
    });
  });
});
