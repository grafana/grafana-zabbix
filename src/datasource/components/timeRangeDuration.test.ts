import { TimeRange, dateTime } from '@grafana/data';
import { formatDuration, getTimeRangeDurationDays, isTimeRangeLarge } from './timeRangeDuration';

function createTimeRange(from: string, to: string): TimeRange {
  const fromDate = dateTime(from);
  const toDate = dateTime(to);
  return {
    from: fromDate,
    to: toDate,
    raw: {
      from: fromDate,
      to: toDate,
    },
  };
}

describe('timeRangeDuration', () => {
  describe('getTimeRangeDurationDays', () => {
    it('should calculate duration correctly for 1 day', () => {
      const timeRange = createTimeRange('2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z');

      const result = getTimeRangeDurationDays(timeRange);
      expect(result).toBeCloseTo(1, 5);
    });

    it('should calculate duration correctly for 7 days', () => {
      const timeRange = createTimeRange('2024-01-01T00:00:00Z', '2024-01-08T00:00:00Z');

      const result = getTimeRangeDurationDays(timeRange);
      expect(result).toBeCloseTo(7, 5);
    });

    it('should calculate duration correctly for 365 days', () => {
      const timeRange = createTimeRange('2023-01-01T00:00:00Z', '2024-01-01T00:00:00Z');

      const result = getTimeRangeDurationDays(timeRange);
      expect(result).toBeCloseTo(365, 5);
    });

    it('should calculate duration correctly for partial days', () => {
      const timeRange = createTimeRange('2024-01-01T00:00:00Z', '2024-01-01T12:00:00Z'); // 12 hours = 0.5 days

      const result = getTimeRangeDurationDays(timeRange);
      expect(result).toBeCloseTo(0.5, 5);
    });

    it('should handle zero duration', () => {
      const timeRange = createTimeRange('2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z');

      const result = getTimeRangeDurationDays(timeRange);
      expect(result).toBe(0);
    });
  });

  describe('isTimeRangeLarge', () => {
    it('should return true when duration equals threshold', () => {
      const timeRange = createTimeRange('2024-01-01T00:00:00Z', '2025-01-01T00:00:00Z'); // 365 days

      const result = isTimeRangeLarge(timeRange, 365);
      expect(result).toBe(true);
    });

    it('should return true when duration exceeds threshold', () => {
      const timeRange = createTimeRange('2024-01-01T00:00:00Z', '2025-06-01T00:00:00Z'); // ~516 days

      const result = isTimeRangeLarge(timeRange, 365);
      expect(result).toBe(true);
    });

    it('should return false when duration is below threshold', () => {
      const timeRange = createTimeRange('2024-01-01T00:00:00Z', '2024-12-30T00:00:00Z'); // 364 days

      const result = isTimeRangeLarge(timeRange, 365);
      expect(result).toBe(false);
    });

    it('should use default threshold when not specified', () => {
      const timeRange = createTimeRange('2023-01-01T00:00:00Z', '2024-01-01T00:00:00Z'); // 365 days

      const result = isTimeRangeLarge(timeRange);
      expect(result).toBe(true);
    });

    it('should use custom threshold when specified', () => {
      const timeRange = createTimeRange('2024-01-01T00:00:00Z', '2024-01-08T00:00:00Z'); // 7 days

      const result = isTimeRangeLarge(timeRange, 7);
      expect(result).toBe(true);
    });
  });

  describe('formatDuration', () => {
    it('should format single day correctly', () => {
      expect(formatDuration(1)).toBe('1 days');
    });

    it('should format multiple days correctly', () => {
      expect(formatDuration(7)).toBe('7 days');
      expect(formatDuration(30)).toBe('30 days');
      expect(formatDuration(364)).toBe('364 days');
    });

    it('should format exactly 365 days as 1 year', () => {
      expect(formatDuration(365)).toBe('1 year');
    });

    it('should format multiple years correctly', () => {
      expect(formatDuration(730)).toBe('2 years');
      expect(formatDuration(1095)).toBe('3 years');
    });

    it('should format years with remaining days correctly', () => {
      expect(formatDuration(366)).toBe('1 year and 1 day');
      expect(formatDuration(370)).toBe('1 year and 5 days');
      expect(formatDuration(730)).toBe('2 years');
      expect(formatDuration(731)).toBe('2 years and 1 day');
      expect(formatDuration(800)).toBe('2 years and 70 days');
    });

    it('should handle fractional days by flooring', () => {
      expect(formatDuration(1.9)).toBe('1 days');
      expect(formatDuration(365.9)).toBe('1 year');
      expect(formatDuration(366.5)).toBe('1 year and 1 day');
    });

    it('should handle zero days', () => {
      expect(formatDuration(0)).toBe('0 days');
    });

    it('should handle very large durations', () => {
      expect(formatDuration(3650)).toBe('10 years');
      expect(formatDuration(3651)).toBe('10 years and 1 day');
    });
  });
});
