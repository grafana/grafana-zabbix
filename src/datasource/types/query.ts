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
  | typeof c.MODE_LOGS;

type BaseQuery = { queryType: QueryType; datasourceUid?: string } & DataQuery;

export type LogsSource = typeof c.LOGS_SOURCE_ITEM | typeof c.LOGS_SOURCE_APM;

// OTEL attribute scopes of the Zabbix 8.0 APM log object (apmlog.get)
export type ApmAttributeScope = 'resource' | 'scope' | 'log';

export interface ApmAttributeFilter {
  scope: ApmAttributeScope;
  key: string;
  value: string;
  // apmlog.get attribute operators: 0 Contains, 1 Equals, 2 Does not contain,
  // 3 Does not equal, 4 Exists, 5 Does not exist
  operator: number;
}

export interface ApmLogsFilter {
  service?: string;
  traceId?: string;
  // OTEL SeverityNumber lower bound (1-24), 0 = any
  minSeverity?: number;
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
  // Logs: data source ('item' when absent, for queries saved before APM support)
  logsSource?: LogsSource;
  apmFilter?: ApmLogsFilter;
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
