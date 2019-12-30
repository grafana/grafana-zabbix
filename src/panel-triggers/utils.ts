import _ from 'lodash';
import moment from 'moment';
import { DataQuery } from '@grafana/ui/';
import * as utils from '../datasource-zabbix/utils';
import { ZBXTrigger } from './types';

export function isNewProblem(problem: ZBXTrigger, highlightNewerThan: string): boolean {
  try {
    const highlightIntervalMs = utils.parseInterval(highlightNewerThan);
    const durationSec = (Date.now() - problem.lastchangeUnix * 1000);
    return durationSec < highlightIntervalMs;
  } catch (e) {
    return false;
  }
}

const DEFAULT_TIME_FORMAT = "DD MMM YYYY HH:mm:ss";

export function formatLastChange(lastchangeUnix: number, customFormat?: string) {
  const timestamp = moment.unix(lastchangeUnix);
  const format = customFormat || DEFAULT_TIME_FORMAT;
  const lastchange = timestamp.format(format);
  return lastchange;
}

export const getNextRefIdChar = (queries: DataQuery[]): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  return _.find(letters, refId => {
    return _.every(queries, other => {
      return other.refId !== refId;
    });
  });
};
