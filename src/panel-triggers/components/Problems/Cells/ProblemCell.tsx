import { RTCell } from '../../../types';
import { ProblemDTO } from '../../../../datasource/types';
import React from 'react';

export function ProblemCell(props: RTCell<ProblemDTO>) {
  // const comments = props.original.comments;
  return (
    <div>
      <span className="problem-description">{props.value}</span>
      {/* {comments && <FAIcon icon="file-text-o" customClass="comments-icon" />} */}
    </div>
  );
}
