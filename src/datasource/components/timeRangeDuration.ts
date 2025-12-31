import { TimeRange } from '@grafana/data';
import { TIME_RANGE_WARNING_THRESHOLD_DAYS } from '../constants';

export function getTimeRangeDurationDays(timeRange: TimeRange): number {
  const from = timeRange.from.valueOf();
  const to = timeRange.to.valueOf();
  const durationMs = to - from;
  return durationMs / (1000 * 60 * 60 * 24);
}

export function isTimeRangeLarge(
  timeRange: TimeRange,
  thresholdDays: number = TIME_RANGE_WARNING_THRESHOLD_DAYS
): boolean {
  return getTimeRangeDurationDays(timeRange) >= thresholdDays;
}

/**
 * Formats a duration in days as a human-readable string.
 * Formats durations >= 365 days as years and days, otherwise as days only.
 * Based on Zabbix best practices:
 *   - Zabbix "Max period for time selector" defaults to 2 years (range: 1-10 years)
 *     See: https://www.zabbix.com/documentation/current/en/manual/web_interface/frontend_sections/administration/general
 * Our limit are conservative to ensure good performance
 */
export function formatDuration(days: number): string {
  if (days >= TIME_RANGE_WARNING_THRESHOLD_DAYS) {
    const years = Math.floor(days / TIME_RANGE_WARNING_THRESHOLD_DAYS);
    const remainingDays = Math.floor(days % TIME_RANGE_WARNING_THRESHOLD_DAYS);
    if (remainingDays > 0) {
      return `${years} year${years > 1 ? 's' : ''} and ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    }
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  return `${Math.floor(days)} days`;
}
