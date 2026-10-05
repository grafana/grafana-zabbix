import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Cell } from '@tanstack/react-table';
import { isNewProblem } from '../../../utils';
import { ProblemDTO } from '../../../../datasource/types';

const getStyles = (theme: GrafanaTheme2) => ({
  status: css({
    fontWeight: theme.typography.fontWeightMedium,
    letterSpacing: '0.02em',
  }),
  problem: css({ color: theme.colors.error.text }),
  ok: css({ color: theme.colors.success.text }),
});

export function StatusCellV8(props: { cell: Cell<ProblemDTO, string>; highlightNewerThan?: string }) {
  const { cell, highlightNewerThan } = props;
  const styles = useStyles2(getStyles);
  const isProblem = cell.getValue() !== '0';
  const newProblem = highlightNewerThan ? isNewProblem(cell.row.original, highlightNewerThan) : false;

  return (
    <span className={cx(styles.status, isProblem ? styles.problem : styles.ok, { 'problem-status--new': newProblem })}>
      {isProblem ? 'PROBLEM' : 'RESOLVED'}
    </span>
  );
}
