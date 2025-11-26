import { RTCell } from '../../../types';
import { ProblemDTO } from '../../../../datasource/types';
import { isNewProblem } from '../../../utils';
import { cx } from '@emotion/css';
import { GFHeartIcon } from '../../../../components';
import React from 'react';

export function StatusIconCell(props: RTCell<ProblemDTO>, highlightNewerThan?: string) {
  const status = props.value === '0' ? 'ok' : 'problem';
  let newProblem = false;
  if (highlightNewerThan) {
    newProblem = isNewProblem(props.original, highlightNewerThan);
  }
  const className = cx(
    'zbx-problem-status-icon',
    { 'problem-status--new': newProblem },
    { 'zbx-problem': props.value === '1' },
    { 'zbx-ok': props.value === '0' }
  );
  return <GFHeartIcon status={status} className={className} />;
}
