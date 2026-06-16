import React from 'react';
import { Cell } from '@tanstack/react-table';
import { isNewProblem } from '../../../utils';
import { ProblemDTO } from '../../../../datasource/types';
import { DEFAULT_OK_COLOR, DEFAULT_PROBLEM_COLOR } from '../constants';

export function StatusCellV8(props: { cell: Cell<ProblemDTO, string>; highlightNewerThan?: string }) {
  const { cell, highlightNewerThan } = props;
  const status = cell.getValue() === '0' ? 'RESOLVED' : 'PROBLEM';
  const color = cell.getValue() === '0' ? DEFAULT_OK_COLOR : DEFAULT_PROBLEM_COLOR;
  let newProblem = false;
  if (highlightNewerThan) {
    newProblem = isNewProblem(cell.row.original, highlightNewerThan);
  }
  return (
    <span className={newProblem ? 'problem-status--new' : ''} style={{ color }}>
      {status}
    </span>
  );
}
