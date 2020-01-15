import _ from 'lodash';
import { migrateCredentials, migrateDSConfig } from './migrations';
import * as constants from './constants';

const SUPPORTED_SQL_DS = ['mysql', 'postgres', 'influxdb'];

const zabbixVersions = [
  { name: '2.x', value: 2 },
  { name: '3.x', value: 3 },
  { name: '4.x', value: 4 },
];

export class ZabbixDSConfigController {
  /** @ngInject */
  constructor($scope, $injector, datasourceSrv) {
    /**
     * @type {import('./types').CurrentConfig}
     */
    this.current;
    this.datasourceSrv = datasourceSrv;

    this.current.jsonData = migrateDSConfig(this.current.jsonData);
    _.defaults(this.current.jsonData, constants.DEFAULT_CONFIG);
    migrateCredentials(this);

    this.dbConnectionDatasourceId = this.current.jsonData.dbConnectionDatasourceId;
    this.dbDataSources = this.getSupportedDBDataSources();
    this.zabbixVersions = _.cloneDeep(zabbixVersions);
    this.autoDetectZabbixVersion();
    if (!this.dbConnectionDatasourceId) {
      this.loadCurrentDBDatasource();
    }
  }

  resetUsername() {
    this.current.secureJsonFields.username = false;
    if (!this.current.secureJsonData) {
      this.current.secureJsonData = {};
    }
    this.current.secureJsonData.username = null;
  }

  resetPassword() {
    this.current.secureJsonFields.password = false;
    if (!this.current.secureJsonData) {
      this.current.secureJsonData = {};
    }
    this.current.secureJsonData.password = null;
  }

  getSupportedDBDataSources() {
    let datasources = this.datasourceSrv.getAll();
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
    this.datasourceSrv.loadDatasource(dsName)
    .then(ds => {
      if (ds) {
        this.dbConnectionDatasourceId = ds.id;
      }
    });
  }

  autoDetectZabbixVersion() {
    if (!this.current.id) {
      return;
    }

    this.datasourceSrv.loadDatasource(this.current.name)
    .then(ds => {
      return ds.getVersion();
    })
    .then(version => {
      if (version) {
        if (!_.find(zabbixVersions, ['value', version])) {
          this.zabbixVersions.push({ name: version + '.x', value: version });
        }
        this.current.jsonData.zabbixVersion = version;
      }
    });
  }

  onDBConnectionDatasourceChange() {
    this.current.jsonData.dbConnectionDatasourceId = this.dbConnectionDatasourceId;
  }
}
