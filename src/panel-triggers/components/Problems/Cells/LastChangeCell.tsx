import React from 'react';
import { TimeZone } from '@grafana/schema';
import { ProblemDTO } from '../../../../datasource/types';
import { formatLastChange } from '../../../utils';

export function LastChangeCell(props: { original: ProblemDTO; customFormat?: string; timeZone?: TimeZone }) {
  const { original, customFormat, timeZone } = props;
  return <span>{formatLastChange(original.timestamp, customFormat, timeZone)}</span>;
}
