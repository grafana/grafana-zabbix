import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { TIME_RANGE_WARNING_THRESHOLD_DAYS } from '../constants';

interface TimeRangeWarningProps {
  timeRange?: TimeRange;
}

function getTimeRangeDurationDays(timeRange: TimeRange): number {
  const from = timeRange.from.valueOf();
  const to = timeRange.to.valueOf();
  const durationMs = to - from;
  return durationMs / (1000 * 60 * 60 * 24);
}

function isTimeRangeLarge(timeRange: TimeRange, thresholdDays: number = TIME_RANGE_WARNING_THRESHOLD_DAYS): boolean {
  return getTimeRangeDurationDays(timeRange) >= thresholdDays;
}

function formatDuration(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const remainingDays = Math.floor(days % 365);
    if (remainingDays > 0) {
      return `${years} year${years > 1 ? 's' : ''} and ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    }
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  return `${Math.floor(days)} days`;
}

/**
 * A warning banner that displays when the selected time range is very large.
 * This is a non-intrusive warning that doesn't block the query flow.
 */
export const TimeRangeWarning: React.FC<TimeRangeWarningProps> = ({ timeRange }) => {
  const styles = useStyles2(getStyles);

  if (!timeRange || !isTimeRangeLarge(timeRange)) {
    return null;
  }

  const durationDays = getTimeRangeDurationDays(timeRange);
  const formattedDuration = formatDuration(durationDays);

  return (
    <div className={styles.warningContainer}>
      <Icon name="exclamation-triangle" className={styles.icon} />
      <span className={styles.text}>
        Large time range ({formattedDuration}): This query may return a large amount of data and could take longer to
        execute.
      </span>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  warningContainer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    backgroundColor: theme.colors.warning.transparent,
    borderRadius: theme.shape.radius.default,
    marginBottom: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  icon: css({
    color: theme.colors.warning.text,
    flexShrink: 0,
  }),
  text: css({
    color: theme.colors.warning.text,
  }),
});
