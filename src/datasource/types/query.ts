import { DataQuery } from '@grafana/schema';
import * as c from './../constants';
import { HostTagOperatorValue } from 'datasource/components/QueryEditor/types';

export type QueryType =
  | typeof c.MODE_METRICS
  | typeof c.MODE_ITSERVICE
  | typeof c.MODE_TEXT
  | typeof c.MODE_ITEMID
  | typeof c.MODE_TRIGGERS
  | typeof c.MODE_PROBLEMS
  | typeof c.MODE_MACROS
  | typeof c.MODE_MULTIMETRIC_TABLE;

type BaseQuery = { queryType: QueryType; datasourceId: number } & DataQuery;

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
  triggers?: { minSeverity: number; acknowledged: number; count: boolean };
  countTriggersBy?: 'problems' | 'items' | '';
  evaltype?: ZabbixTagEvalType;
  functions?: MetricFunc[];
  options?: ZabbixQueryOptions;
  // Mutli-metric table
  tableConfig?: MultiMetricTableConfig;
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
  limit?: number;
  useTimeRange?: boolean;
  severities?: number[];
  count?: boolean;

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

export interface EntityPatternConfig {
  searchType: 'itemName' | 'itemKey';
  pattern: string;
  extractPattern?: string;
  extractedColumns?: Array<{
    name: string;
    groupIndex: number;
  }>;
}

export interface MultiMetricTableConfig {
  entityPattern: EntityPatternConfig;
  metrics: MetricColumnConfig[];
  showGroupColumn?: boolean;
  showHostColumn?: boolean;
}

export interface MetricColumnConfig {
  columnName: string;
  searchType: 'itemName' | 'itemKey';
  pattern: string;
  aggregation: 'last' | 'avg' | 'min' | 'max';
}