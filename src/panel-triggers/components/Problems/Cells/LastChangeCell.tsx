import React from 'react';
import moment from 'moment/moment';
import { ProblemDTO } from '../../../../datasource/types';

export function LastChangeCellV8(props: { original: ProblemDTO; customFormat?: string }) {
  const { original, customFormat } = props;
  const DEFAULT_TIME_FORMAT = 'DD MMM YYYY HH:mm:ss';
  const timestamp = moment.unix(original.timestamp);
  const format = customFormat || DEFAULT_TIME_FORMAT;
  return <span>{timestamp.format(format)}</span>;
}
