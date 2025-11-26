// eslint-disable-next-line no-restricted-imports
import moment from 'moment';
import React from 'react';
import { RTCell } from '../../../types';
import { ProblemDTO } from '../../../../datasource/types';

export function AgeCell(props: RTCell<ProblemDTO>) {
  const problem = props.original;
  const timestamp = moment.unix(problem.timestamp);
  const age = timestamp.fromNow(true);
  return <span>{age}</span>;
}
