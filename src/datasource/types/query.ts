import { DataQuery } from '@grafana/schema';
import * as c from './../constants';
import { HostTagOperatorValue, TagOperatorValue } from 'datasource/components/QueryEditor/types';

export type QueryType =
  | typeof c.MODE_METRICS
  | typeof c.MODE_ITSERVICE
  | typeof c.MODE_TEXT
  | typeof c.MODE_ITEMID
  | typeof c.MODE_TRIGGERS
  | typeof c.MODE_PROBLEMS
  | typeof c.MODE_MACROS;

type BaseQuery = { queryType: QueryType; datasourceUid?: string } & DataQuery;

export type ZabbixMetricsQuery = {
  schema: number;
  group: { filter: string; name?: string };
  host: { filter: string; name?: string };
  application: { filter: string; name?: string };
  itemTag: { filter: string; name?: string };
  item: { filter: string; name?: string };
  macro: { filter: string; macro?: string };
  textFilter: string;
  mode: number;
  itemids: string;
  useCaptureGroups: boolean;
  hostTags?: HostTagFilter[];
  proxy?: { filter: string };
  trigger?: { filter: string };
  itServiceFilter?: string;
  slaFilter?: string;
  slaProperty?: any;
  slaInterval?: string;
  tags?: { filter: string };
  // Structured problem tag filters with per-tag operator (replaces the free-text
  // `tags.filter` for problems queries since query schema 13).
  problemTags?: ProblemTagFilter[];
  triggers?: { minSeverity: number; acknowledged: number; count: boolean };
  countTriggersBy?: 'problems' | 'items' | '';
  evaltype?: ZabbixTagEvalType;
  functions?: MetricFunc[];
  options?: ZabbixQueryOptions;
  // Metrics / Item ID queries: annotate the panel with problems of the queried items' triggers
  problemAnnotations?: ProblemAnnotationsOptions;
  // Problems
  showProblems?: ShowProblemTypes;
  // Deprecated
  hostFilter?: string;
  itemFilter?: string;
  macroFilter?: string;
} & BaseQuery;

/**
 * Panel annotations built from the problems of the triggers that reference the
 * items a Metrics or Item ID query returns. Every field is optional so queries
 * saved before this existed keep their behavior.
 */
export interface ProblemAnnotationsOptions {
  /** Unset follows the data source default (`problemAnnotationsByDefault`). */
  enabled?: boolean;
  minSeverity?: number;
  hideAcknowledged?: boolean;
  /**
   * Restricts which of the queried items' triggers are used, matched on the trigger
   * name like the other metric filters: an exact name, a `/regex/` (several triggers,
   * or exclusions with a negative lookahead) or a template variable. Empty or unset
   * means every trigger of the queried items.
   */
  triggerFilter?: string;
}

export interface ZabbixQueryOptions {
  showDisabledItems?: boolean;
  skipEmptyValues?: boolean;
  disableDataAlignment?: boolean;
  useZabbixValueMapping?: boolean;
  useTrends?: 'default' | 'true' | 'false';
  // Problems options
  minSeverity?: number;
  sortProblems?: string;
  acknowledged?: number;
  hostsInMaintenance?: boolean;
  hostProxy?: boolean;
  // When enabled, fetch host interfaces (host.get + selectInterfaces) to show
  // the host IP. Off by default to avoid the extra API call.
  hostIp?: boolean;
  limit?: number;
  useTimeRange?: boolean;
  severities?: number[];
  count?: boolean;
  symptom?: boolean | null; // null = all, true = only symptoms, false = only causes
  // When enabled, fetch each problem's item value at its creation time via
  // history.get. Off by default — it is costly in large environments (issue #2427).
  fetchHistoricalItemValue?: boolean;

  // Annotations
  showOkEvents?: boolean;
  hideAcknowledged?: boolean;
  showHostname?: boolean;
}

export interface MetricFunc {
  text: string;
  params: Array<string | number>;
  def: FuncDef;
  added?: boolean;
}

export interface FuncDef {
  name: string;
  params: ParamDef[];
  defaultParams: Array<string | number>;
  category?: string;
  shortName?: any;
  fake?: boolean;
  version?: string;
  description?: string;
  /**
   * True if the function was not found on the list of available function descriptions.
   */
  unknown?: boolean;
}

export type ParamDef = {
  name: string;
  type: string;
  options?: Array<string | number>;
  multiple?: boolean;
  optional?: boolean;
  version?: string;
};

export enum ShowProblemTypes {
  Problems = 'problems',
  Recent = 'recent',
  History = 'history',
}

export enum ZabbixTagEvalType {
  AndOr = '0',
  Or = '2',
}

export interface HostTagFilter {
  tag: string;
  value: string;
  operator: HostTagOperatorValue;
}

export interface ProblemTagFilter {
  tag: string;
  value: string;
  operator: TagOperatorValue;
}
