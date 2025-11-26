import React from 'react';
import { isNewProblem } from '../../../utils';
import { RTCell } from '../../../types';
import { ProblemDTO } from '../../../../datasource/types';
import { DEFAULT_OK_COLOR, DEFAULT_PROBLEM_COLOR } from '../constants';

export function StatusCell(props: RTCell<ProblemDTO>, highlightNewerThan?: string) {
  const status = props.value === '0' ? 'RESOLVED' : 'PROBLEM';
  const color = props.value === '0' ? DEFAULT_OK_COLOR : DEFAULT_PROBLEM_COLOR;
  let newProblem = false;
  if (highlightNewerThan) {
    newProblem = isNewProblem(props.original, highlightNewerThan);
  }
  return (
    <span className={newProblem ? 'problem-status--new' : ''} style={{ color }}>
      {status}
    </span>
  );
}
