import _ from 'lodash';
import { getDataSourceSrv } from '@grafana/runtime';
import { migrateDSConfig } from './migrations';

const SUPPORTED_SQL_DS = ['mysql', 'postgres', 'influxdb'];

const defaultConfig = {
  trends: false,
  dbConnectionEnable: false,
  dbConnectionDatasourceId: null,
  alerting: false,
  addThresholds: false,
  alertingMinSeverity: 3,
  disableReadOnlyUsersAck: false,
};

export class ZabbixDSConfigController {

  /** @ngInject */
  constructor() {
    this.current.jsonData = migrateDSConfig(this.current.jsonData);
    _.defaults(this.current.jsonData, defaultConfig);

    this.dbConnectionDatasourceId = this.current.jsonData.dbConnectionDatasourceId;
    this.dbDataSources = this.getSupportedDBDataSources();
    if (!this.dbConnectionDatasourceId) {
      this.loadCurrentDBDatasource();
    }
  }

  getSupportedDBDataSources() {
    let datasources = getDataSourceSrv().getAll();
    return _.filter(datasources, ds => {
      return _.includes(SUPPORTED_SQL_DS, ds.type);
    });
  }

  getCurrentDatasourceType() {
    const dsId = this.dbConnectionDatasourceId;
    const currentDs = _.find(this.dbDataSources, { 'id': dsId });
    return currentDs ? currentDs.type : null;
  }

  loadCurrentDBDatasource() {
    const dsName= this.current.jsonData.dbConnectionDatasourceName;
    getDataSourceSrv().loadDatasource(dsName)
    .then(ds => {
      if (ds) {
        this.dbConnectionDatasourceId = ds.id;
      }
    });
  }

  onDBConnectionDatasourceChange() {
    this.current.jsonData.dbConnectionDatasourceId = this.dbConnectionDatasourceId;
  }
}
