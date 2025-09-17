import { DataFrame, FieldType, TIME_SERIES_TIME_FIELD_NAME } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import dataProcessor from '../dataProcessor';

// Mock the template service
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(),
}));

const mockTemplateSrv = getTemplateSrv as jest.MockedFunction<typeof getTemplateSrv>;

describe('DataProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTemplateSrv.mockReturnValue({
      replace: jest.fn((text: string) => text),
    } as any);
  });

  describe('setAlias', () => {
    it('should set alias for a simple time series DataFrame', () => {
      const frame: DataFrame = {
        name: 'original_name',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000, 2000, 3000],
            config: {},
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20, 30],
            config: {},
          },
        ],
        length: 3,
      };

      const result = dataProcessor.metricFunctions.setAlias('new_alias', frame);

      expect(result.name).toBe('new_alias');
      expect(result.fields[1].config.displayNameFromDS).toBe('new_alias');
    });

    it('should set alias with template variable replacement', () => {
      const mockReplace = jest.fn((text: string) => text.replace('$host', 'server1'));
      mockTemplateSrv.mockReturnValue({
        replace: mockReplace,
      } as any);

      const frame: DataFrame = {
        name: 'original_name',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000, 2000],
            config: {},
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20],
            config: {
              custom: {
                scopedVars: { host: { value: 'server1' } },
              },
            },
          },
        ],
        length: 2,
      };

      const result = dataProcessor.metricFunctions.setAlias('CPU usage on $host', frame);

      expect(mockReplace).toHaveBeenCalledWith('CPU usage on $host', { host: { value: 'server1' } });
      expect(result.fields[1].config.displayNameFromDS).toBe('CPU usage on server1');
    });

    it('should handle DataFrame with multiple value fields', () => {
      const frame: DataFrame = {
        name: 'original_name',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000, 2000],
            config: {},
          },
          {
            name: 'cpu_user',
            type: FieldType.number,
            values: [10, 20],
            config: {},
          },
          {
            name: 'cpu_system',
            type: FieldType.number,
            values: [5, 10],
            config: {},
          },
        ],
        length: 2,
      };

      const result = dataProcessor.metricFunctions.setAlias('CPU metrics', frame);

      expect(result.fields[1].config.displayNameFromDS).toBe('CPU metrics');
      expect(result.fields[2].config.displayNameFromDS).toBe('CPU metrics');
    });

    it('should handle empty DataFrame gracefully', () => {
      const frame: DataFrame = {
        name: 'empty_frame',
        fields: [],
        length: 0,
      };

      const result = dataProcessor.metricFunctions.setAlias('test_alias', frame);

      expect(result.name).toBe('test_alias');
    });
  });

  describe('replaceAlias', () => {
    it('should replace alias using string pattern', () => {
      const frame: DataFrame = {
        name: 'cpu.usage.server1',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000, 2000],
            config: {},
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20],
            config: {
              displayNameFromDS: 'cpu.usage.server1',
            },
          },
        ],
        length: 2,
      };

      const result = dataProcessor.metricFunctions.replaceAlias('server1', 'production', frame);

      expect(result.name).toBe('cpu.usage.production');
      expect(result.fields[1].config.displayNameFromDS).toBe('cpu.usage.production');
    });

    it('should replace alias using regex pattern', () => {
      const frame: DataFrame = {
        name: 'metric.host123.value',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000, 2000],
            config: {},
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20],
            config: {
              displayNameFromDS: 'metric.host123.value',
            },
          },
        ],
        length: 2,
      };

      const result = dataProcessor.metricFunctions.replaceAlias('/host\\d+/', 'server', frame);

      expect(result.name).toBe('metric.server.value');
      expect(result.fields[1].config.displayNameFromDS).toBe('metric.server.value');
    });

    it('should handle template variable replacement in replaced alias', () => {
      const mockReplace = jest.fn((text: string) => text.replace('$env', 'production'));
      mockTemplateSrv.mockReturnValue({
        replace: mockReplace,
      } as any);

      const frame: DataFrame = {
        name: 'cpu.usage.dev',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000, 2000],
            config: {},
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20],
            config: {},
            state: {
              scopedVars: { env: { value: 'production' } },
            },
          },
        ],
        length: 2,
      };

      dataProcessor.metricFunctions.replaceAlias('dev', '$env', frame);

      expect(mockReplace).toHaveBeenCalledWith('cpu.usage.$env', { env: { value: 'production' } });
    });

    it('should handle multiple value fields', () => {
      const frame: DataFrame = {
        name: 'original_name',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000, 2000],
            config: {},
          },
          {
            name: 'cpu_user',
            type: FieldType.number,
            values: [10, 20],
            config: {
              displayNameFromDS: 'cpu.user.server1',
            },
          },
          {
            name: 'cpu_system',
            type: FieldType.number,
            values: [5, 10],
            config: {
              displayNameFromDS: 'cpu.system.server1',
            },
          },
        ],
        length: 2,
      };

      const result = dataProcessor.metricFunctions.replaceAlias('server1', 'production', frame);

      expect(result.fields[1].name).toBe('cpu.user.production');
      expect(result.fields[2].name).toBe('cpu.system.production');
    });
  });

  describe('setAliasByRegex', () => {
    it('should extract text using regex pattern', () => {
      const frame: DataFrame = {
        name: 'system.cpu.util[,user,avg1] on server1',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000, 2000],
            config: {},
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20],
            config: {
              displayNameFromDS: 'system.cpu.util[,user,avg1] on server1',
            },
          },
        ],
        length: 2,
      };

      const result = dataProcessor.metricFunctions.setAliasByRegex('server\\d+', frame);

      expect(result.name).toBe('server1');
      expect(result.fields[1].config.displayNameFromDS).toBe('server1');
    });

    it('should handle regex extraction for multiple fields', () => {
      const frame: DataFrame = {
        name: 'original_name',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000, 2000],
            config: {},
          },
          {
            name: 'cpu_user',
            type: FieldType.number,
            values: [10, 20],
            config: {
              displayNameFromDS: 'cpu.user on host123',
            },
          },
          {
            name: 'cpu_system',
            type: FieldType.number,
            values: [5, 10],
            config: {
              displayNameFromDS: 'cpu.system on host456',
            },
          },
        ],
        length: 2,
      };

      const result = dataProcessor.metricFunctions.setAliasByRegex('host\\d+', frame);

      expect(result.fields[1].config.displayNameFromDS).toBe('host123');
      expect(result.fields[2].config.displayNameFromDS).toBe('host456');
    });

    it('should handle invalid regex gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const frame: DataFrame = {
        name: 'test.metric',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000],
            config: {},
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10],
            config: {
              displayNameFromDS: 'test.metric',
            },
          },
        ],
        length: 1,
      };

      // Invalid regex pattern - unmatched brackets
      dataProcessor.metricFunctions.setAliasByRegex('[invalid', frame);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to apply RegExp:', expect.any(String));

      consoleSpy.mockRestore();
    });

    it('should handle case when regex does not match', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const frame: DataFrame = {
        name: 'metric.without.numbers',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000],
            config: {},
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10],
            config: {
              displayNameFromDS: 'metric.without.numbers',
            },
          },
        ],
        length: 1,
      };

      // This should log an error because the regex doesn't match (returns null)
      const result = dataProcessor.metricFunctions.setAliasByRegex('\\d+', frame);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to apply RegExp:', expect.any(String));

      // Frame should be returned unchanged
      expect(result.name).toBe('metric.without.numbers');

      consoleSpy.mockRestore();
    });
  });

  describe('timeShift', () => {
    it('should shift time range by specified interval', () => {
      const timeRange = [1609459200, 1609462800]; // 2021-01-01 00:00:00 to 2021-01-01 01:00:00 UTC
      const interval = '1h';

      const result = dataProcessor.metricFunctions.timeShift(interval, timeRange);

      // Should shift back by 1 hour (3600 seconds)
      expect(result).toEqual([1609455600, 1609459200]);
    });

    it('should handle negative time shift', () => {
      const timeRange = [1609459200, 1609462800];
      const interval = '-30m';

      const result = dataProcessor.metricFunctions.timeShift(interval, timeRange);

      // Negative interval shifts back in time by 30 minutes (1800 seconds)
      expect(result).toEqual([1609457400, 1609461000]);
    });

    it('should handle different time units', () => {
      const timeRange = [1609459200];

      // Test minutes
      let result = dataProcessor.metricFunctions.timeShift('15m', timeRange);
      expect(result).toEqual([1609458300]);

      // Test seconds
      result = dataProcessor.metricFunctions.timeShift('30s', timeRange);
      expect(result).toEqual([1609459170]);

      // Test days
      result = dataProcessor.metricFunctions.timeShift('1d', timeRange);
      expect(result).toEqual([1609372800]);
    });

    it('should handle empty time range', () => {
      const timeRange: number[] = [];
      const interval = '1h';

      const result = dataProcessor.metricFunctions.timeShift(interval, timeRange);

      expect(result).toEqual([]);
    });
  });

  describe('metricFunctions integration', () => {
    it('should expose all expected functions', () => {
      const functions = dataProcessor.metricFunctions;

      expect(functions).toHaveProperty('setAlias');
      expect(functions).toHaveProperty('setAliasByRegex');
      expect(functions).toHaveProperty('replaceAlias');
      expect(functions).toHaveProperty('timeShift');

      expect(typeof functions.setAlias).toBe('function');
      expect(typeof functions.setAliasByRegex).toBe('function');
      expect(typeof functions.replaceAlias).toBe('function');
      expect(typeof functions.timeShift).toBe('function');
    });

    it('should maintain function context when used in sequence', () => {
      // This tests the integration with the sequence function from utils
      const frame: DataFrame = {
        name: 'cpu.usage.server1',
        fields: [
          {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            values: [1000, 2000],
            config: {},
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20],
            config: {},
          },
        ],
        length: 2,
      };

      // Test chaining multiple operations
      let result = dataProcessor.metricFunctions.replaceAlias('server1', 'production', frame);
      result = dataProcessor.metricFunctions.setAlias('Final Alias', result);

      expect(result.name).toBe('Final Alias');
      expect(result.fields[1].config.displayNameFromDS).toBe('Final Alias');
    });
  });
});
