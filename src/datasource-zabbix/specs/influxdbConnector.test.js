import { InfluxDBConnector } from '../zabbix/connectors/influxdb/influxdbConnector';
import { compactQuery } from '../utils';

describe('InfluxDBConnector', () => {
  let ctx = {};

  beforeEach(() => {
    ctx.options = { datasourceName: 'InfluxDB DS' };
    ctx.datasourceSrvMock = {
      loadDatasource: jest.fn().mockResolvedValue(
        { id: 42, name: 'InfluxDB DS', meta: {} }
      ),
    };
    ctx.influxDBConnector = new InfluxDBConnector(ctx.options, ctx.datasourceSrvMock);
    ctx.influxDBConnector.invokeInfluxDBQuery = jest.fn().mockResolvedValue([]);
    ctx.defaultQueryParams = {
      itemids: ['123', '234'],
      timeFrom: 15000, timeTill: 15100, intervalSec: 5,
      table: 'history', aggFunction: 'MAX'
    };
  });

  describe('When building InfluxDB query', () => {
    it('should build proper query', () => {
      const { itemids, timeFrom, timeTill, intervalSec, table, aggFunction } = ctx.defaultQueryParams;
      const query = ctx.influxDBConnector.buildHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction);
      const expected = compactQuery(`SELECT MAX("value")
        FROM "history" WHERE ("itemid" = '123' OR "itemid" = '234') AND "time" >= 15000s AND "time" <= 15100s
        GROUP BY time(5s), "itemid" fill(none)
      `);
      expect(query).toBe(expected);
    });

    it('should use MEAN instead of AVG', () => {
      const { itemids, timeFrom, timeTill, intervalSec, table } = ctx.defaultQueryParams;
      const aggFunction = 'AVG';
      const query = ctx.influxDBConnector.buildHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction);
      const expected = compactQuery(`SELECT MEAN("value")
        FROM "history" WHERE ("itemid" = '123' OR "itemid" = '234') AND "time" >= 15000s AND "time" <= 15100s
        GROUP BY time(5s), "itemid" fill(none)
      `);
      expect(query).toBe(expected);
    });
  });

  describe('When invoking InfluxDB query', () => {
    it('should query proper table depending on item type', () => {
      const { timeFrom, timeTill} = ctx.defaultQueryParams;
      const options = { intervalMs: 5000 };
      const items = [
        { itemid: '123', value_type: 3 }
      ];
      const expectedQuery = compactQuery(`SELECT MEAN("value")
        FROM "history_uint" WHERE ("itemid" = '123') AND "time" >= 15000s AND "time" <= 15100s
        GROUP BY time(5s), "itemid" fill(none)
      `);
      ctx.influxDBConnector.getHistory(items, timeFrom, timeTill, options);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenCalledWith(expectedQuery);
    });

    it('should split query if different item types are used', () => {
      const { timeFrom, timeTill} = ctx.defaultQueryParams;
      const options = { intervalMs: 5000 };
      const items = [
        { itemid: '123', value_type: 0 },
        { itemid: '234', value_type: 3 },
      ];
      const sharedQueryPart = `AND "time" >= 15000s AND "time" <= 15100s GROUP BY time(5s), "itemid" fill(none)`;
      const expectedQueryFirst = compactQuery(`SELECT MEAN("value")
        FROM "history" WHERE ("itemid" = '123') ${sharedQueryPart}
      `);
      const expectedQuerySecond = compactQuery(`SELECT MEAN("value")
        FROM "history_uint" WHERE ("itemid" = '234') ${sharedQueryPart}
      `);
      ctx.influxDBConnector.getHistory(items, timeFrom, timeTill, options);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenCalledTimes(2);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenNthCalledWith(1, expectedQueryFirst);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenNthCalledWith(2, expectedQuerySecond);
    });

    it('should use the same table for trends query', () => {
      const { timeFrom, timeTill} = ctx.defaultQueryParams;
      const options = { intervalMs: 5000 };
      const items = [
        { itemid: '123', value_type: 3 }
      ];
      const expectedQuery = compactQuery(`SELECT MEAN("value")
        FROM "history_uint" WHERE ("itemid" = '123') AND "time" >= 15000s AND "time" <= 15100s
        GROUP BY time(5s), "itemid" fill(none)
      `);
      ctx.influxDBConnector.getTrends(items, timeFrom, timeTill, options);
      expect(ctx.influxDBConnector.invokeInfluxDBQuery).toHaveBeenCalledWith(expectedQuery);
    });
  });
});
