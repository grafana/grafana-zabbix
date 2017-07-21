import angular from 'angular';
import _ from 'lodash';

/** @ngInject */
function ZabbixDBConnectorFactory(datasourceSrv, backendSrv) {

  class ZabbixDBConnector {

    constructor(sqlDataSourceId) {
      this.sqlDataSourceId = sqlDataSourceId;

      // Try to load DS with given id to check it's exist
      this.loadSQLDataSource(sqlDataSourceId);
    }

    loadSQLDataSource(datasourceId) {
      let ds = _.find(datasourceSrv.getAll(), {'id': datasourceId});
      if (ds) {
        return datasourceSrv.loadDatasource(ds.name)
        .then(ds => {
          console.log('SQL data source loaded', ds);
        });
      } else {
        return Promise.reject(`SQL Data Source with ID ${datasourceId} not found`);
      }
    }

    invokeSQLQuery(query) {
      let queryDef = {
        refId: 'A',
        format: 'table',
        datasourceId: this.sqlDataSourceId,
        rawSql: query
      };

      return backendSrv.datasourceRequest({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          queries: [queryDef],
        }
      })
      .then(response => {
        let results = response.data.results;
        if (results['A']) {
          return _.head(results['A'].tables);
        } else {
          return null;
        }
      });
    }
  }

  return ZabbixDBConnector;
}

angular
  .module('grafana.services')
  .factory('ZabbixDBConnector', ZabbixDBConnectorFactory);
