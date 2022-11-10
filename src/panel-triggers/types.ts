import { DataSourceRef } from '@grafana/data';
import { CURRENT_SCHEMA_VERSION } from './migrations';

export interface ProblemsPanelOptions {
  schemaVersion: number;
  datasources: any[];
  targets: ProblemsPanelTarget[];
  layout: 'table' | 'list';
  // Fields
  hostField?: boolean;
  hostTechNameField?: boolean;
  hostGroups?: boolean;
  hostProxy?: boolean;
  showTags?: boolean;
  statusField?: boolean;
  statusIcon?: boolean;
  severityField?: boolean;
  ackField?: boolean;
  ageField?: boolean;
  descriptionField?: boolean;
  descriptionAtNewLine?: boolean;
  // Options
  hostsInMaintenance?: boolean;
  showTriggers?: 'all triggers' | 'unacknowledged' | 'acknowledged';
  sortProblems?: 'default' | 'lastchange' | 'priority';
  showEvents?: Number[];
  limit?: number;
  // View options
  fontSize?: string;
  pageSize?: number;
  problemTimeline?: boolean;
  highlightBackground?: boolean;
  highlightNewEvents?: boolean;
  highlightNewerThan?: string;
  customLastChangeFormat?: boolean;
  lastChangeFormat?: string;
  resizedColumns?: RTResized;
  // Triggers severity and colors
  triggerSeverity?: TriggerSeverity[];
  okEventColor?: TriggerColor;
  ackEventColor?: TriggerColor;
  markAckEvents?: boolean;
}

export const DEFAULT_SEVERITY = [
  { priority: 0, severity: 'Not classified', color: 'rgb(108, 108, 108)', show: true },
  { priority: 1, severity: 'Information', color: 'rgb(120, 158, 183)', show: true },
  { priority: 2, severity: 'Warning', color: 'rgb(175, 180, 36)', show: true },
  { priority: 3, severity: 'Average', color: 'rgb(255, 137, 30)', show: true },
  { priority: 4, severity: 'High', color: 'rgb(255, 101, 72)', show: true },
  { priority: 5, severity: 'Disaster', color: 'rgb(215, 0, 0)', show: true },
];

export const getDefaultSeverity = () => DEFAULT_SEVERITY;

export const defaultPanelOptions: Partial<ProblemsPanelOptions> = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  // Fields
  hostField: true,
  hostTechNameField: false,
  hostProxy: false,
  hostGroups: false,
  showTags: true,
  statusField: true,
  statusIcon: false,
  severityField: true,
  ackField: true,
  ageField: false,
  descriptionField: true,
  descriptionAtNewLine: false,
  // Options
  sortProblems: 'lastchange',
  limit: null,
  // View options
  layout: 'table',
  fontSize: '100%',
  pageSize: 10,
  problemTimeline: true,
  highlightBackground: false,
  highlightNewEvents: false,
  highlightNewerThan: '1h',
  customLastChangeFormat: false,
  lastChangeFormat: '',
  resizedColumns: [],
  // Triggers severity and colors
  triggerSeverity: getDefaultSeverity(),
  okEventColor: 'rgb(56, 189, 113)',
  ackEventColor: 'rgb(56, 219, 156)',
  markAckEvents: false,
};

export interface ProblemsPanelTarget {
  group: {
    filter: string;
  };
  host: {
    filter: string;
  };
  application: {
    filter: string;
  };
  trigger: {
    filter: string;
  };
  tags: {
    filter: string;
  };
  proxy: {
    filter: string;
  };
  datasource: string;
}

export interface TriggerSeverity {
  priority: number;
  severity: string;
  color: TriggerColor;
  show: boolean;
}

export type TriggerColor = string;

export interface ZBXTrigger {
  acknowledges?: ZBXAcknowledge[];
  showAckButton?: boolean;
  alerts?: ZBXAlert[];
  age?: string;
  color?: TriggerColor;
  comments?: string;
  correlation_mode?: string;
  correlation_tag?: string;
  datasource?: DataSourceRef | string;
  description?: string;
  error?: string;
  expression?: string;
  flags?: string;
  groups?: ZBXGroup[];
  host?: string;
  hostTechName?: string;
  hosts?: ZBXHost[];
  items?: ZBXItem[];
  lastEvent?: ZBXEvent;
  lastchange?: string;
  lastchangeUnix?: number;
  maintenance?: boolean;
  manual_close?: string;
  priority?: string;
  proxy?: string;
  recovery_expression?: string;
  recovery_mode?: string;
  severity?: string;
  state?: string;
  status?: string;
  tags?: ZBXTag[];
  templateid?: string;
  triggerid?: string;
  /** Whether the trigger can generate multiple problem events. */
  type?: string;
  url?: string;
  value?: string;
}

export interface ZBXGroup {
  groupid: string;
  name: string;
}

export interface ZBXHost {
  hostid: string;
  name: string;
}

export interface ZBXItem {
  itemid: string;
  name: string;
  key_: string;
  lastvalue?: string;
}

export interface ZBXEvent {
  eventid: string;
  clock: string;
  ns?: string;
  value?: string;
  source?: string;
  object?: string;
  objectid?: string;
  acknowledged?: string;
  severity?: string;
  hosts?: ZBXHost[];
  acknowledges?: ZBXAcknowledge[];
}

export interface ZBXTag {
  tag: string;
  value?: string;
}

export interface ZBXAcknowledge {
  acknowledgeid: string;
  eventid: string;
  userid: string;
  action: string;
  clock: string;
  time: string;
  message?: string;
  user: string;
  alias: string;
  name: string;
  surname: string;
}

export interface ZBXAlert {
  eventid: string;
  clock: string;
  message: string;
  error: string;
}

export interface GFTimeRange {
  timeFrom: number;
  timeTo: number;
}

export interface RTRow<T> {
  /** the materialized row of data */
  row: any;
  /** the original row of data */
  original: T;
  /** the index of the row in the original array */
  index: number;
  /** the index of the row relative to the current view */
  viewIndex: number;
  /** the nesting level of this row */
  level: number;
  /** the nesting path of this row */
  nestingPath: number[];
  /** true if this row's values were aggregated */
  aggregated?: boolean;
  /** true if this row was produced by a pivot */
  groupedByPivot?: boolean;
  /** any sub rows defined by the `subRowKey` prop */
  subRows?: boolean;
}

export interface RTCell<T> extends RTRow<T> {
  /** true if this row is expanded */
  isExpanded?: boolean;
  /** the materialized value of this cell */
  value: any;
  /** the resize information for this cell's column */
  resized: any[];
  /** true if the column is visible */
  show?: boolean;
  /** the resolved width of this cell */
  width: number;
  /** the resolved maxWidth of this cell */
  maxWidth: number;
  /** the resolved tdProps from `getTdProps` for this cell */
  tdProps: any;
  /** the resolved column props from 'getProps' for this cell's column */
  columnProps: any;
  /** the resolved array of classes for this cell */
  classes: string[];
  /** the resolved styles for this cell */
  styles: any;
}

export interface RTResize {
  id: string;
  value: number;
}

export type RTResized = RTResize[];
