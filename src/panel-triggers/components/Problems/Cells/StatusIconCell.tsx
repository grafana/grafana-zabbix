import React from 'react';
import { css, cx, keyframes } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Row } from '@tanstack/react-table';
import { ProblemDTO } from '../../../../datasource/types';
import { isNewProblem } from '../../../utils';
import { em } from './cellStyles';

const ping = keyframes({
  '0%': { transform: 'scale(1)', opacity: 0.7 },
  '100%': { transform: 'scale(2.4)', opacity: 0 },
});

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  dot: css({
    position: 'relative',
    display: 'inline-block',
    width: em(theme, 8),
    height: em(theme, 8),
    borderRadius: '50%',
    background: 'currentColor',
  }),
  problem: css({
    color: theme.colors.error.main,
    boxShadow: `0 0 0 3px ${theme.colors.error.transparent}`,
  }),
  ok: css({
    color: theme.colors.success.main,
    boxShadow: `0 0 0 3px ${theme.colors.success.transparent}`,
  }),
  // "Highlight new events": an expanding ring in the dot's own colour
  isNew: css({
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: -2,
      borderRadius: '50%',
      border: '2px solid currentColor',
      animation: `${ping} 1.6s ease-out infinite`,
    },
    '@media (prefers-reduced-motion: reduce)': {
      '&::after': { animation: 'none', opacity: 0.5 },
    },
  }),
});

export function StatusIconCellV8(props: { cellValue: string; row: Row<ProblemDTO>; highlightNewerThan?: string }) {
  const { cellValue, row, highlightNewerThan } = props;
  const styles = useStyles2(getStyles);
  const isProblem = cellValue !== '0';
  const newProblem = highlightNewerThan ? isNewProblem(row.original, highlightNewerThan) : false;

  return (
    <span className={styles.wrapper}>
      <span
        role="img"
        aria-label={isProblem ? 'Problem' : 'Resolved'}
        className={cx(styles.dot, isProblem ? styles.problem : styles.ok, { [styles.isNew]: newProblem })}
      />
    </span>
  );
}
