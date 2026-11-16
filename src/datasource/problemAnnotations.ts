import { createDataFrame, DataFrame, DataTopic, FieldType } from '@grafana/data';
import { DEFAULT_SEVERITY } from '../panel-triggers/types';
import * as c from './constants';
import * as utils from './utils';
import { SeverityOverride } from './types/config';
import { ProblemAnnotationsOptions, ZabbixMetricsQuery } from './types/query';

/** Upper bound on events (problems and recoveries) fetched per panel, newest first. */
export const PROBLEM_ANNOTATIONS_LIMIT = 2000;

export interface ProblemAnnotationTrigger {
  triggerid: string;
  description: string;
  priority: string;
  hosts?: Array<{ name: string }>;
  items?: Array<{ itemid: string }>;
}

export interface ProblemAnnotationEvent {
  eventid: string;
  objectid: string;
  clock: string;
  /** '1' problem, '0' recovery */
  value?: string;
  name: string;
  severity?: string;
  r_eventid?: string;
  acknowledged?: string;
  tags?: Array<{ tag: string; value: string }>;
}

/** True when the query is a Metrics / Item ID query that should carry problem annotations. */
export function isProblemAnnotationsTarget(target: Partial<ZabbixMetricsQuery>, enabledByDefault = false): boolean {
  if (target.hide || (target as any).fromAnnotations) {
    return false;
  }
  const queryType = target.queryType;
  if (queryType && queryType !== c.MODE_METRICS && queryType !== c.MODE_ITEMID) {
    return false;
  }
  if (queryType === c.MODE_ITEMID && !target.itemids) {
    return false;
  }
  return target.problemAnnotations?.enabled ?? enabledByDefault;
}

/**
 * Keep the triggers matching the query's trigger filter, with the same semantics as
 * the other metric filters: `/regex/` or exact name. No filter keeps every trigger.
 */
export function selectTriggers(
  triggers: ProblemAnnotationTrigger[],
  options: ProblemAnnotationsOptions = {}
): ProblemAnnotationTrigger[] {
  const filter = options.triggerFilter?.trim();
  if (!filter) {
    return triggers;
  }
  if (utils.isRegex(filter)) {
    const pattern = utils.buildRegex(filter);
    return triggers.filter((t) => pattern.test(t.description));
  }
  return triggers.filter((t) => t.description === filter);
}

/**
 * Item ids per query (refId) of the series a response carries, read from the
 * `__zbx_item_id` scoped var the backend sets on each item's series. Must run before
 * the wide conversion, which merges the series of several queries into one frame.
 */
export function collectItemIdsByRefId(frames: DataFrame[] | undefined | null): Map<string, Set<string>> {
  const byRefId = new Map<string, Set<string>>();
  // Never let this break the panel's data: responses may hold non-frame objects
  for (const frame of Array.isArray(frames) ? frames : []) {
    if (!frame?.refId || !Array.isArray(frame.fields)) {
      continue;
    }
    for (const field of frame.fields) {
      const itemid = field.config?.custom?.scopedVars?.__zbx_item_id?.value;
      if (itemid) {
        const ids = byRefId.get(frame.refId) ?? new Set<string>();
        ids.add(String(itemid));
        byRefId.set(frame.refId, ids);
      }
    }
  }
  return byRefId;
}

/** Triggers that reference at least one of the given items. */
export function triggersOfItems(triggers: ProblemAnnotationTrigger[], itemids: string[]): ProblemAnnotationTrigger[] {
  const ids = new Set(itemids);
  return triggers.filter((t) => (t.items ?? []).some((i) => ids.has(i.itemid)));
}

/**
 * Problem events of one query: its triggers, at or above its minimum severity, and
 * unacknowledged when it hides acknowledged problems. The minimum applies to the
 * event's own severity, which an operator may have changed from the trigger's.
 */
export function selectProblemEvents(
  events: ProblemAnnotationEvent[],
  triggerids: Set<string>,
  options: ProblemAnnotationsOptions = {}
): ProblemAnnotationEvent[] {
  const minSeverity = Number(options.minSeverity ?? 0);
  return events.filter(
    (e) =>
      e.value !== '0' &&
      triggerids.has(e.objectid) &&
      Number(e.severity ?? 0) >= minSeverity &&
      !(options.hideAcknowledged && e.acknowledged === '1')
  );
}

/** Recovery clocks (unix seconds) by recovery event id. */
export function recoveryClocksFrom(events: ProblemAnnotationEvent[]): Record<string, number> {
  return Object.fromEntries(events.filter((e) => e.value === '0').map((e) => [e.eventid, Number(e.clock)]));
}

function severityStyle(priority: number, overrides?: SeverityOverride[]) {
  const defaults = DEFAULT_SEVERITY.find((s) => s.priority === priority) ?? DEFAULT_SEVERITY[0];
  const override = overrides?.find((o) => o.priority === priority);
  return {
    name: override?.name || defaults.severity,
    color: override?.color || defaults.color,
  };
}

export interface BuildFrameParams {
  events: ProblemAnnotationEvent[];
  triggers: ProblemAnnotationTrigger[];
  /** Recovery event clocks (unix seconds) by recovery event id */
  recoveryClocks: Record<string, number>;
  /** End of the region of a problem still open, or resolved after the range, in ms */
  rangeEndMs: number;
  severityOverrides?: SeverityOverride[];
}

/**
 * Builds one annotation frame (`meta.dataTopic = annotations`). Grafana moves such
 * frames out of the panel's series into its annotations, so they only show on the
 * panel that ran the query and never reach transformations or field overrides.
 */
export function buildProblemAnnotationsFrame(params: BuildFrameParams): DataFrame {
  const { events, triggers, recoveryClocks, rangeEndMs, severityOverrides } = params;
  const triggersById = new Map(triggers.map((t) => [t.triggerid, t]));

  const time: number[] = [];
  const timeEnd: number[] = [];
  const isRegion: boolean[] = [];
  const title: string[] = [];
  const text: string[] = [];
  const tags: string[][] = [];
  const color: string[] = [];
  const id: string[] = [];

  const seen = new Set<string>();
  for (const event of events) {
    const trigger = triggersById.get(event.objectid);
    if (!trigger || event.value === '0' || seen.has(event.eventid)) {
      continue;
    }
    seen.add(event.eventid);

    const start = Number(event.clock) * 1000;
    const resolved = !!event.r_eventid && event.r_eventid !== '0';
    // A recovery after the range end is not fetched; the region then runs to the range end
    const recoveryClock = resolved ? recoveryClocks[event.r_eventid!] : undefined;
    const end = recoveryClock ? recoveryClock * 1000 : Math.max(start, rangeEndMs);
    const priority = Number(event.severity ?? trigger.priority);
    const severity = severityStyle(priority, severityOverrides);
    const hostNames = (trigger.hosts ?? []).map((h) => h.name);

    time.push(start);
    timeEnd.push(end);
    isRegion.push(end > start);
    title.push(`${severity.name}${resolved ? ' (resolved)' : ''}`);
    text.push(event.name || trigger.description);
    tags.push([...hostNames, ...(event.tags ?? []).map((t) => (t.value ? `${t.tag}:${t.value}` : t.tag))]);
    color.push(severity.color);
    id.push(event.eventid);
  }

  return createDataFrame({
    name: 'Zabbix problems',
    meta: { dataTopic: DataTopic.Annotations },
    fields: [
      { name: 'time', type: FieldType.time, values: time },
      { name: 'timeEnd', type: FieldType.time, values: timeEnd },
      { name: 'isRegion', type: FieldType.boolean, values: isRegion },
      { name: 'title', type: FieldType.string, values: title },
      { name: 'text', type: FieldType.string, values: text },
      { name: 'tags', type: FieldType.other, values: tags },
      { name: 'color', type: FieldType.string, values: color },
      { name: 'id', type: FieldType.string, values: id },
    ],
  });
}
