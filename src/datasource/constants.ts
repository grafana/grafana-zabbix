// Plugin IDs
export const ZABBIX_PROBLEMS_PANEL_ID = 'alexanderzobnin-zabbix-triggers-panel';
export const ZABBIX_DS_ID = 'alexanderzobnin-zabbix-datasource';

// Data point
export const DATAPOINT_VALUE = 0;
export const DATAPOINT_TS = 1;

// Editor modes
export const MODE_METRICS = '0';
export const MODE_ITSERVICE = '1';
export const MODE_TEXT = '2';
export const MODE_ITEMID = '3';
export const MODE_TRIGGERS = '4';
export const MODE_PROBLEMS = '5';
export const MODE_MACROS = '6';

// Metrics query data sources
export const METRICS_SOURCE_ITEM = 'item';
// APM (OpenTelemetry) metrics, Zabbix 8.0+ (apmmetric.get)
export const METRICS_SOURCE_APM = 'apm';
export const ZABBIX_APM_METRICS_MIN_VERSION = '8.0.0';
// Raw data points one APM metrics query fetches by default (apmmetric.get cannot downsample)
export const DEFAULT_APM_METRICS_MAX_POINTS = 50000;
// Newest data points sampled to suggest services, metric names and attributes in the query editor
export const APM_METRICS_LOOKUP_LIMIT = 5000;
// APM metric data point types
export const APM_METRIC_TYPE_GAUGE = 0;
export const APM_METRIC_TYPE_SUM = 1;
export const APM_METRIC_TYPE_HISTOGRAM = 2;
export const APM_METRIC_TYPE_EXPONENTIAL_HISTOGRAM = 3;

// Triggers severity
export const SEV_NOT_CLASSIFIED = 0;
export const SEV_INFORMATION = 1;
export const SEV_WARNING = 2;
export const SEV_AVERAGE = 3;
export const SEV_HIGH = 4;
export const SEV_DISASTER = 5;

export const SHOW_ALL_TRIGGERS = [0, 1];
export const SHOW_ALL_EVENTS = [0, 1];
export const SHOW_OK_EVENTS = 1;

// Acknowledge
export const ZBX_ACK_ACTION_NONE = 0;
export const ZBX_ACK_ACTION_CLOSE = 1;
export const ZBX_ACK_ACTION_ACK = 2;
export const ZBX_ACK_ACTION_ADD_MESSAGE = 4;
export const ZBX_ACK_ACTION_CHANGE_SEVERITY = 8;

export const TRIGGER_SEVERITY = [
  { val: 0, text: 'Not classified' },
  { val: 1, text: 'Information' },
  { val: 2, text: 'Warning' },
  { val: 3, text: 'Average' },
  { val: 4, text: 'High' },
  { val: 5, text: 'Disaster' },
];

/** Minimum interval for SLA over time (1 hour) */
export const MIN_SLA_INTERVAL = 3600;

export const RANGE_VARIABLE_VALUE = 'range_series';

export const DEFAULT_ZABBIX_PROBLEMS_LIMIT = 1001;

export const ITEM_COUNT_WARNING_THRESHOLD = 500;

export const TIME_RANGE_WARNING_THRESHOLD_DAYS = 365;
