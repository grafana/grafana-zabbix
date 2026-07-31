import _ from 'lodash';
import { dateMath, SelectableValue } from '@grafana/data';
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

/** A problem is a symptom when it points to a cause event (Zabbix 6.4+). '0' means the problem is a cause. */
export function isSymptomEvent(problem: ProblemDTO): boolean {
  return !!problem.cause_eventid && problem.cause_eventid !== '0';
}

/**
 * Problems from the panel which can be selected as the cause event when ranking
 * a problem as symptom: any other problem which is itself a cause.
 */
export function getCauseEventOptions(
  panelProblems: ProblemDTO[] | undefined,
  problem: ProblemDTO
): Array<SelectableValue<string>> {
  return (panelProblems || [])
    .filter((p) => p.eventid && p.eventid !== problem.eventid && !isSymptomEvent(p))
    .map((p) => ({
      value: p.eventid,
      label: p.host ? `${p.host}: ${p.name || p.description}` : p.name || p.description,
    }));
}

/** Compute AckModal action visibility from the problem state and the server's action capabilities. */
export function getAckModalActionProps(problem: ProblemDTO, panelProblems?: ProblemDTO[]) {
  const capabilities = problem.actionCapabilities || {};
  const isAcknowledged = problem.acknowledged === '1';
  const isSuppressed = problem.suppressed === '1';
  const isSymptom = isSymptomEvent(problem);

  return {
    canAck: !isAcknowledged,
    canClose: problem.manual_close === '1',
    canUnack: !!capabilities.unacknowledge && isAcknowledged,
    canSuppress: !!capabilities.suppress && !isSuppressed,
    canUnsuppress: !!capabilities.suppress && isSuppressed,
    canRankAsCause: !!capabilities.rank && isSymptom,
    canRankAsSymptom: !!capabilities.rank && !isSymptom,
    causeEvents: getCauseEventOptions(panelProblems, problem),
  };
}
