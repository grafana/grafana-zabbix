import { RTCell } from '../../../types';
import { ProblemDTO } from '../../../../datasource/types';
import React from 'react';

export function GroupCell(props: RTCell<ProblemDTO>) {
  let groups = '';
  if (props.value && props.value.length) {
    groups = props.value.map((g) => g.name).join(', ');
  }
  return <span>{groups}</span>;
}
