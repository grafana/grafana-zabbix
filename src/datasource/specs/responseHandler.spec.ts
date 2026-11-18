import { FieldType, MutableDataFrame } from '@grafana/data';
import { convertToWide, seriesToDataFrame } from '../responseHandler';
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

  describe('convertToWide()', () => {
    it('keeps the labels of the value fields and the notices of the merged frames', () => {
      const frame = (name: string, labels: Record<string, string>, notices?: any[]) =>
        new MutableDataFrame({
          refId: 'A',
          name,
          meta: notices ? { notices } : undefined,
          fields: [
            { name: 'Time', type: FieldType.time, values: [1000, 2000] },
            { name: 'Value', type: FieldType.number, values: [1, 2], labels },
          ],
        });
      const notice = { severity: 'warning', text: 'only the newest 50000 are shown' };

      const [wide] = convertToWide([frame('a', { state: 'used' }, [notice]), frame('b', { state: 'free' })]);

      expect(wide.fields.map((f) => f.name)).toEqual(['Time', 'a', 'b']);
      expect(wide.fields[1].labels).toEqual({ state: 'used' });
      expect(wide.fields[2].labels).toEqual({ state: 'free' });
      expect(wide.meta?.notices).toEqual([notice]);
    });
  });
});
