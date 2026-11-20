import { FieldType } from '@grafana/data';
import responseHandler, { parseCoordinate, seriesToDataFrame } from '../responseHandler';
import { ZabbixMetricsQuery } from '../types/query';

describe('responseHandler', () => {
  describe('seriesToDataFrame()', () => {
    it('should copy scopedVars including item tags into config.custom.scopedVars', () => {
      const timeseries = {
        target: 'CPU load',
        datapoints: [[10, 1000]],
        scopedVars: {
          __zbx_item: { value: 'CPU load' },
          __zbx_item_name: { value: 'CPU load' },
          __zbx_item_key: { value: 'system.cpu.load' },
          __zbx_item_interval: { value: '1m' },
          __zbx_item_tag_service: { value: 'checkout' },
          __zbx_item_tag_App_Name: { value: 'api' },
        },
        item: {
          units: '',
        },
      };

      const frame = seriesToDataFrame(timeseries, { refId: 'A' } as ZabbixMetricsQuery);
      const valueField = frame.fields.find((field) => field.type === FieldType.number);

      expect(valueField?.config?.custom?.scopedVars).toEqual(timeseries.scopedVars);
      expect(valueField?.labels).toMatchObject({
        item: 'CPU load',
        item_key: 'system.cpu.load',
      });
    });
  });

  describe('parseCoordinate()', () => {
    it.each([
      ['-33.4489', -33.4489],
      [' 12,5 ', 12.5],
      ['', null],
      [undefined, null],
      ['abc', null],
      ['95', null],
    ])('parses %p as %p for latitude', (input, expected) => {
      expect(parseCoordinate(input, 90)).toBe(expected);
    });
  });

  describe('handleInventory()', () => {
    it('returns one row per host with numeric latitude/longitude and string fields', () => {
      const hosts = [
        { hostid: '1', name: 'sw-01', inventory: { location_lat: '-33.45', location_lon: '-70.66', os: 'IOS' } },
        { hostid: '2', name: 'sw-02', inventory: [] },
      ];
      const frame = responseHandler.handleInventory(hosts, ['location_lat', 'location_lon', 'os'], { refId: 'A' });

      expect(frame.name).toBe('inventory');
      expect(frame.fields.map((f) => [f.name, f.type])).toEqual([
        ['Host', FieldType.string],
        ['latitude', FieldType.number],
        ['longitude', FieldType.number],
        ['os', FieldType.string],
      ]);
      expect(frame.fields.map((f) => f.values)).toEqual([
        ['sw-01', 'sw-02'],
        [-33.45, null],
        [-70.66, null],
        ['IOS', ''],
      ]);
    });
  });
});
