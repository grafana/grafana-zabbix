import _ from 'lodash';
import { migrateDSConfig } from './migrations';

const SUPPORTED_SQL_DS = ['mysql', 'postgres'];

const defaultConfig = {
  trends: false,
  dbConnectionEnable: false,
  dbConnectionDatasourceId: null,
  alerting: false,
  addThresholds: false,
  alertingMinSeverity: 3,
  disableReadOnlyUsersAck: false
};

export class ZabbixDSConfigController {

  /** @ngInject */
  constructor($scope, $injector, datasourceSrv) {
    this.datasourceSrv = datasourceSrv;

    this.current.jsonData = migrateDSConfig(this.current.jsonData);
    _.defaults(this.current.jsonData, defaultConfig);
    this.sqlDataSources = this.getSupportedSQLDataSources();
  }

  getSupportedSQLDataSources() {
    let datasources = this.datasourceSrv.getAll();
    return _.filter(datasources, ds => {
      return _.includes(SUPPORTED_SQL_DS, ds.type);
    });
  }
}
