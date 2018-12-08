export interface ProblemsPanelOptions {
  schemaVersion: number;
  datasources: any[];
  targets: Map<string, ProblemsPanelTarget>;
  // Fields
  hostField?: boolean;
  hostTechNameField?: boolean;
  hostGroups?: boolean;
  hostProxy?: boolean;
  showTags?: boolean;
  statusField?: boolean;
  severityField?: boolean;
  descriptionField?: boolean;
  descriptionAtNewLine?: boolean;
  // Options
  hostsInMaintenance?: boolean;
  showTriggers?: 'all triggers' | 'unacknowledged' | 'acknowledges';
  sortTriggersBy?: {
    text: string;
    value: 'lastchange' | 'priority';
  };
  showEvents?: {
    text: 'All' | 'OK' | 'Problems';
    value: 1 | Array<0 | 1>;
  };
  limit?: number;
  // View options
  fontSize?: string;
  pageSize?: number;
  highlightBackground?: boolean;
  highlightNewEvents?: boolean;
  highlightNewerThan?: string;
  customLastChangeFormat?: boolean;
  lastChangeFormat?: string;
  // Triggers severity and colors
  triggerSeverity?: TriggerSeverity[];
  okEventColor?: TriggerColor;
  ackEventColor?: TriggerColor;
}

export interface ProblemsPanelTarget {
  group: {
    filter: string
  };
  host: {
    filter: string
  };
  application: {
    filter: string
  };
  trigger: {
    filter: string
  };
  tags: {
    filter: string
  };
  proxy: {
    filter: string
  };
}

export interface TriggerSeverity {
  priority: number;
  severity: string;
  color: TriggerColor;
  show: boolean;
}

export type TriggerColor = string;

export interface Trigger {
  acknowledges?: ZBXAcknowledge[];
  alerts?: ZBXAlert[];
  age?: string;
  color?: TriggerColor;
  comments?: string;
  correlation_mode?: string;
  correlation_tag?: string;
  datasource?: string;
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
  clock: string;
  message: string;
  error: string;
}
