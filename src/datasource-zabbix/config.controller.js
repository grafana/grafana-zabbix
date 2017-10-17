import _ from 'lodash';

const SUPPORTED_SQL_DS = ['mysql', 'postgres'];

const defaultConfig = {
  dbConnection: {
    enable: false,
  }
};

export class ZabbixDSConfigController {
  /** @ngInject */
  constructor($scope, $injector, datasourceSrv) {
    this.datasourceSrv = datasourceSrv;

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

ZabbixDSConfigController.templateUrl = 'datasource-zabbix/partials/config.html';
