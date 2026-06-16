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
  opdataField?: boolean;
  descriptionField?: boolean;
  descriptionAtNewLine?: boolean;
  showDatasourceName?: boolean;
  // Options
  hostsInMaintenance?: boolean;
  showTriggers?: 'all triggers' | 'unacknowledged' | 'acknowledged';
  sortProblems?: 'default' | 'lastchange' | 'priority';
  showEvents?: Number[];
  limit?: number;
  // View options
  fontSize: string;
  pageSize?: number;
  problemTimeline?: boolean;
  highlightBackground?: boolean;
  highlightNewEvents?: boolean;
  highlightNewerThan?: string;
  customLastChangeFormat?: boolean;
  lastChangeFormat?: string;
  resizedColumns?: RTResized;
  allowDangerousHTML: boolean;
  // Triggers severity and colors
  triggerSeverity: TriggerSeverity[];
  okEventColor: TriggerColor;
  ackEventColor: TriggerColor;
  markAckEvents?: boolean;
  // Custom tag names to display as column
  customTagColumns?: string;
}

export const DEFAULT_SEVERITY: TriggerSeverity[] = [
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
  opdataField: false,
  descriptionField: true,
  descriptionAtNewLine: false,
  showDatasourceName: false,
  // Options
  sortProblems: 'lastchange',
  limit: undefined,
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
  allowDangerousHTML: false,
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

export interface RTResize {
  id: string;
  value: number;
}

export type RTResized = RTResize[];
