import _ from 'lodash';
import { getDataSourceSrv } from '@grafana/runtime';

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

/**
 * Base class for external history database connectors. Subclasses should implement `getHistory()`, `getTrends()` and
 * `testDataSource()` methods, which describe how to fetch data from source other than Zabbix API.
 */
export class DBConnector {
  protected datasourceId: any;
  private datasourceName: any;
  protected datasourceTypeId: any;
  // private datasourceTypeName: any;

  constructor(options) {
    this.datasourceId = options.datasourceId;
    this.datasourceName = options.datasourceName;
    this.datasourceTypeId = null;
    // this.datasourceTypeName = null;
  }

  static loadDatasource(dsId, dsName) {
    if (!dsName && dsId !== undefined) {
      const ds = _.find(getDataSourceSrv().getList(), { id: dsId });
      if (!ds) {
        return Promise.reject(`Data Source with ID ${dsId} not found`);
      }
      dsName = ds.name;
    }
    if (dsName) {
      return getDataSourceSrv().get(dsName);
    } else {
      return Promise.reject(`Data Source name should be specified`);
    }
  }

  loadDBDataSource() {
    return DBConnector.loadDatasource(this.datasourceId, this.datasourceName).then((ds) => {
      this.datasourceTypeId = ds.meta.id;
      // this.datasourceTypeName = ds.meta.name;
      if (!this.datasourceName) {
        this.datasourceName = ds.name;
      }
      if (!this.datasourceId) {
        this.datasourceId = ds.id;
      }
      return ds;
    });
  }
}

export default {
  DBConnector,
  DEFAULT_QUERY_LIMIT,
  HISTORY_TO_TABLE_MAP,
  TREND_TO_TABLE_MAP,
  consolidateByFunc,
  consolidateByTrendColumns,
};
