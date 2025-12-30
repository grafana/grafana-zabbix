import { TriggerSeverity } from '../../../types';
import { ProblemDTO } from '../../../../datasource/types';
import _ from 'lodash';
import React from 'react';
import { DEFAULT_OK_COLOR } from '../constants';
import { Cell } from '@tanstack/react-table';

export function SeverityCell(props: {
  cell: Cell<ProblemDTO, string>;
  problemSeverityDesc: TriggerSeverity[];
  markAckEvents?: boolean;
  ackEventColor?: string;
  okColor?: string;
}) {
  const { cell, problemSeverityDesc, markAckEvents, ackEventColor, okColor = DEFAULT_OK_COLOR } = props;
  const {
    row: {
      original: { severity, acknowledged },
    },
  } = cell;
  let color: string;

  let severityDesc: TriggerSeverity;
  const severityAsNum = Number(severity);
  severityDesc = _.find(problemSeverityDesc, (s) => s.priority === severityAsNum);
  if (severity && cell.getValue() === '1') {
    severityDesc = _.find(problemSeverityDesc, (s) => s.priority === severityAsNum);
  }

  color = cell.getValue() === '0' ? okColor : severityDesc.color;

  // Mark acknowledged triggers with different color
  if (markAckEvents && acknowledged === '1') {
    color = ackEventColor;
  }

  return (
    <div className="severity-cell" style={{ background: color }}>
      {severityDesc.severity}
    </div>
  );
}
