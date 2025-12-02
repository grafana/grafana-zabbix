import React from 'react';
// eslint-disable-next-line no-restricted-imports
import moment from 'moment';
import { RTCell } from '../../../types';
import { ProblemDTO } from '../../../../datasource/types';

export function LastChangeCellV8(props: { original: ProblemDTO; customFormat?: string }) {
  const { original, customFormat } = props;
  const DEFAULT_TIME_FORMAT = 'DD MMM YYYY HH:mm:ss';
  const timestamp = moment.unix(original.timestamp);
  const format = customFormat || DEFAULT_TIME_FORMAT;
  const lastchange = timestamp.format(format);
  return (
    <div>
      <span>{lastchange}</span>
    </div>
  );
}

export function LastChangeCell(props: RTCell<ProblemDTO>, customFormat?: string) {
  const DEFAULT_TIME_FORMAT = 'DD MMM YYYY HH:mm:ss';
  const problem = props.original;
  const timestamp = moment.unix(problem.timestamp);
  const format = customFormat || DEFAULT_TIME_FORMAT;
  const lastchange = timestamp.format(format);
  return <span>{lastchange}</span>;
}
