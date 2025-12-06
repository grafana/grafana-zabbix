import { ProblemDTO } from '../../../../datasource/types';
import { isNewProblem } from '../../../utils';
import React from 'react';
import { Row } from '@tanstack/react-table';
import { cx } from '@emotion/css';
import { GFHeartIcon } from '../../../../components';

export function StatusIconCellV8(props: { cellValue: string; row: Row<ProblemDTO>; highlightNewerThan?: string }) {
  const { cellValue, row, highlightNewerThan } = props;
  const status = cellValue === '0' ? 'ok' : 'problem';
  let newProblem = false;
  if (highlightNewerThan) {
    newProblem = isNewProblem(row.original, highlightNewerThan);
  }
  const className = cx(
    'zbx-problem-status-icon',
    { 'problem-status--new': newProblem },
    { 'zbx-problem': cellValue === '1' },
    { 'zbx-ok': cellValue === '0' }
  );
  return <GFHeartIcon status={status} className={className} />;
}
