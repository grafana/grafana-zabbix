import React from 'react';
import { Alert } from '@grafana/ui';
import { formatDuration, getTimeRangeDurationDays, isTimeRangeLarge } from './timeRangeDuration';
import { TimeRange } from '@grafana/data';

interface TimeRangeWarningProps {
  timeRange?: TimeRange;
}

/**
 * A warning banner that displays when the selected time range is very large.
 * This is a non-intrusive warning that doesn't block the query flow.
 */
export const TimeRangeWarning: React.FC<TimeRangeWarningProps> = ({ timeRange }) => {
  if (!timeRange || !isTimeRangeLarge(timeRange)) {
    return null;
  }

  const durationDays = getTimeRangeDurationDays(timeRange);
  const formattedDuration = formatDuration(durationDays);

  return (
    <Alert title="Large time range" severity="warning">
      Selected time range is {formattedDuration}. This query may return a large amount of data and could take longer to
      execute.
    </Alert>
  );
};
