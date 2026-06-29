import { FieldType } from '@grafana/data';
import { seriesToDataFrame } from '../responseHandler';
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
      expect(valueField?.labels).toEqual({
        host: undefined,
        item: 'CPU load',
        item_key: 'system.cpu.load',
      });
    });
  });
});
