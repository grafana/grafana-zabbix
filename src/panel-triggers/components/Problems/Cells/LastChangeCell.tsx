import React from 'react';
import moment from 'moment/moment';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { ProblemDTO } from '../../../../datasource/types';
import { em } from './cellStyles';

const DEFAULT_TIME_FORMAT = 'DD MMM YYYY HH:mm:ss';

const getStyles = (theme: GrafanaTheme2) => ({
  time: css({
    fontSize: em(theme, 12),
    color: theme.colors.text.secondary,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }),
});

export function LastChangeCell(props: { original: ProblemDTO; customFormat?: string }) {
  const { original, customFormat } = props;
  const styles = useStyles2(getStyles);
  const timestamp = moment.unix(original.timestamp);
  const format = customFormat || DEFAULT_TIME_FORMAT;

  return (
    <span className={styles.time} title={timestamp.format(DEFAULT_TIME_FORMAT)}>
      {timestamp.format(format)}
    </span>
  );
}
