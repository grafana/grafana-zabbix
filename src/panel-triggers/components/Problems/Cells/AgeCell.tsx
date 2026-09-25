import React from 'react';
import moment from 'moment/moment';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  age: css({
    color: theme.colors.text.primary,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }),
});

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact age like the mockup: "14m", "1h 03m", "1d 2h", "45d". Keeps the column narrow;
 * the exact timestamp is available on hover.
 */
export function formatAge(ageSeconds: number): string {
  const s = Math.max(0, Math.floor(ageSeconds));
  if (s < MINUTE) {
    return '<1m';
  }
  if (s < HOUR) {
    return `${Math.floor(s / MINUTE)}m`;
  }
  if (s < DAY) {
    const minutes = Math.floor((s % HOUR) / MINUTE);
    return `${Math.floor(s / HOUR)}h ${String(minutes).padStart(2, '0')}m`;
  }
  const days = Math.floor(s / DAY);
  if (days < 7) {
    return `${days}d ${Math.floor((s % DAY) / HOUR)}h`;
  }
  return `${days}d`;
}

export function AgeCell(props: { timestamp: number; now?: number }) {
  const styles = useStyles2(getStyles);
  const time = moment.unix(props.timestamp);
  const now = props.now ?? moment().unix();

  return (
    <span className={styles.age} title={time.format('DD MMM YYYY HH:mm:ss')}>
      {formatAge(now - props.timestamp)}
    </span>
  );
}
