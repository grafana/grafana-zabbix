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
  | typeof c.MODE_MACROS
  | typeof c.MODE_TRACES;

type BaseQuery = { queryType: QueryType; datasourceUid?: string } & DataQuery;

// OTEL attribute scopes that apmtrace.get can filter on
export type ApmAttributeScope = 'resource' | 'span';

export interface ApmAttributeFilter {
  scope: ApmAttributeScope;
  key: string;
  value: string;
  // Attribute operators: 0 Contains, 1 Equals, 2 Does not contain,
  // 3 Does not equal, 4 Exists, 5 Does not exist
  operator: number;
}

export type TracesQueryMode = typeof c.TRACES_MODE_SEARCH | typeof c.TRACES_MODE_TRACE_ID;

export type ApmTraceStatus = '' | 'Error' | 'Ok' | 'Unset';

export interface ApmTracesFilter {
  // Trace ID mode
  traceId?: string;
  // Search mode. A trace matches when any of its spans matches all the filters.
  service?: string;
  spanName?: string;
  status?: ApmTraceStatus;
  // Trace duration bounds, e.g. "100ms", "1.5s" (a bare number is milliseconds)
  minDuration?: string;
  maxDuration?: string;
  attributes?: ApmAttributeFilter[];
}

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
  // Traces: 'search' when absent
  tracesQueryMode?: TracesQueryMode;
  traceFilter?: ApmTracesFilter;
  // Problems
  showProblems?: ShowProblemTypes;
  // Deprecated
  hostFilter?: string;
  itemFilter?: string;
  macroFilter?: string;
} & BaseQuery;

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
