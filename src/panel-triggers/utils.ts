import _ from 'lodash';
import { dateMath } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import * as utils from '../datasource/utils';
import { ProblemDTO } from 'datasource/types';

export function isNewProblem(problem: ProblemDTO, highlightNewerThan: string): boolean {
  try {
    const highlightIntervalMs = utils.parseInterval(highlightNewerThan);
    const durationSec = Date.now() - problem.timestamp * 1000;
    return durationSec < highlightIntervalMs;
  } catch (e) {
    return false;
  }
}

const DEFAULT_TIME_FORMAT = 'DD MMM YYYY HH:mm:ss';

export function formatLastChange(lastchangeUnix: number, customFormat?: string) {
  const date = new Date(lastchangeUnix * 1000);
  const timestamp = dateMath.parse(date);
  const format = customFormat || DEFAULT_TIME_FORMAT;
  const lastchange = timestamp!.format(format);
  return lastchange;
}

export const getNextRefIdChar = (queries: DataQuery[]): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nextLetter = _.find(letters, (refId) => {
    return _.every(queries, (other) => {
      return other.refId !== refId;
    });
  });
  return nextLetter || 'A';
};

/**
 * Whether a user suppressed the problem manually. `suppressed` alone can't tell:
 * it is also '1' when a maintenance suppresses the problem, which unsuppress can't end.
 */
export function isManuallySuppressed(problem: ProblemDTO): boolean {
  return (problem.suppression_data || []).some((s) => !!s.userid && s.userid !== '0');
}

/** Compute AckModal action visibility from the problem state and the server's action capabilities. */
export function getAckModalActionProps(problem: ProblemDTO) {
  const capabilities = problem.actionCapabilities || {};
  const isAcknowledged = problem.acknowledged === '1';
  const manuallySuppressed = isManuallySuppressed(problem);

  return {
    canAck: !isAcknowledged,
    canClose: problem.manual_close === '1',
    canUnack: !!capabilities.unacknowledge && isAcknowledged,
    canSuppress: !!capabilities.suppress && !manuallySuppressed,
    canUnsuppress: !!capabilities.suppress && manuallySuppressed,
  };
}
