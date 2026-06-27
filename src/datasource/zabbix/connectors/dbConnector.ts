export const DEFAULT_QUERY_LIMIT = 10000;

export const HISTORY_TO_TABLE_MAP = {
  '0': 'history',
  '1': 'history_str',
  '2': 'history_log',
  '3': 'history_uint',
  '4': 'history_text',
};

export const TREND_TO_TABLE_MAP = {
  '0': 'trends',
  '3': 'trends_uint',
};

export const consolidateByFunc = {
  avg: 'AVG',
  min: 'MIN',
  max: 'MAX',
  sum: 'SUM',
  count: 'COUNT',
};

export const consolidateByTrendColumns = {
  avg: 'value_avg',
  min: 'value_min',
  max: 'value_max',
  sum: 'num*value_avg', // sum of sums inside the one-hour trend period
};
