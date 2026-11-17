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
// '7' and '8' are legacy values rewritten by migrateNewTriggersCountModes, don't reuse them.
export const MODE_INVENTORY = '9';

// Host inventory fields (Zabbix host inventory object)
export const INVENTORY_FIELDS = [
  'type',
  'type_full',
  'name',
  'alias',
  'os',
  'os_full',
  'os_short',
  'serialno_a',
  'serialno_b',
  'tag',
  'asset_tag',
  'macaddress_a',
  'macaddress_b',
  'hardware',
  'hardware_full',
  'software',
  'software_full',
  'software_app_a',
  'software_app_b',
  'software_app_c',
  'software_app_d',
  'software_app_e',
  'contact',
  'location',
  'location_lat',
  'location_lon',
  'notes',
  'chassis',
  'model',
  'hw_arch',
  'vendor',
  'contract_number',
  'installer_name',
  'deployment_status',
  'url_a',
  'url_b',
  'url_c',
  'host_networks',
  'host_netmask',
  'host_router',
  'oob_ip',
  'oob_netmask',
  'oob_router',
  'date_hw_purchase',
  'date_hw_install',
  'date_hw_expiry',
  'date_hw_decomm',
  'site_address_a',
  'site_address_b',
  'site_address_c',
  'site_city',
  'site_state',
  'site_country',
  'site_zip',
  'site_rack',
  'site_notes',
  'poc_1_name',
  'poc_1_email',
  'poc_1_phone_a',
  'poc_1_phone_b',
  'poc_1_cell',
  'poc_1_screen',
  'poc_1_notes',
  'poc_2_name',
  'poc_2_email',
  'poc_2_phone_a',
  'poc_2_phone_b',
  'poc_2_cell',
  'poc_2_screen',
  'poc_2_notes',
];
export const DEFAULT_INVENTORY_FIELDS = ['location_lat', 'location_lon'];

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
