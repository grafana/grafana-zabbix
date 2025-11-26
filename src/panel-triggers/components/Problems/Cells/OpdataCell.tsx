import { RTCell } from '../../../types';
import { ProblemDTO } from '../../../../datasource/types';
import React from 'react';

export function OpdataCell(props: RTCell<ProblemDTO>) {
  const problem = props.original;
  return (
    <div>
      <span>{problem.opdata}</span>
    </div>
  );
}
