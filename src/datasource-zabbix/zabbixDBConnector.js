import angular from 'angular';
import _ from 'lodash';

const DEFAULT_QUERY_LIMIT = 10000;
const HISTORY_TO_TABLE_MAP = {
  '0': 'history',
  '1': 'history_str',
  '2': 'history_log',
  '3': 'history_uint',
  '4': 'history_text'
};

const TREND_TO_TABLE_MAP = {
  '0': 'trends',
  '3': 'trends_uint'
};

const consolidateByFunc = {
  'avg': 'AVG',
  'min': 'MIN',
  'max': 'MAX',
  'sum': 'SUM',
  'count': 'COUNT'
};

const consolidateByTrendColumns = {
  'avg': 'value_avg',
  'min': 'value_min',
  'max': 'value_max'
};

/** @ngInject */
function ZabbixDBConnectorFactory(datasourceSrv, backendSrv) {

  class ZabbixDBConnector {

    constructor(sqlDataSourceId, options = {}) {
      let {limit} = options;

      this.sqlDataSourceId = sqlDataSourceId;
      this.limit = limit || DEFAULT_QUERY_LIMIT;

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

    getHistory(items, timeFrom, timeTill, options) {
      let {intervalMs, consolidateBy} = options;
      let intervalSec = Math.ceil(intervalMs / 1000);

      consolidateBy = consolidateBy || 'avg';
      let aggFunction = consolidateByFunc[consolidateBy];

      // Group items by value type and perform request for each value type
      let grouped_items = _.groupBy(items, 'value_type');
      let promises = _.map(grouped_items, (items, value_type) => {
        let itemids = _.map(items, 'itemid').join(', ');
        let table = HISTORY_TO_TABLE_MAP[value_type];

        let query = `
          SELECT itemid AS metric, clock AS time_sec, ${aggFunction}(value) as value
            FROM ${table}
            WHERE itemid IN (${itemids})
              AND clock > ${timeFrom} AND clock < ${timeTill}
            GROUP BY time_sec DIV ${intervalSec}, metric
        `;

        query = compactSQLQuery(query);
        return this.invokeSQLQuery(query);
      });

      return Promise.all(promises).then(results => {
        return _.flatten(results);
      });
    }

    getTrends(items, timeFrom, timeTill, options) {
      let {intervalMs, consolidateBy} = options;
      let intervalSec = Math.ceil(intervalMs / 1000);

      consolidateBy = consolidateBy || 'avg';
      let aggFunction = consolidateByFunc[consolidateBy];

      // Group items by value type and perform request for each value type
      let grouped_items = _.groupBy(items, 'value_type');
      let promises = _.map(grouped_items, (items, value_type) => {
        let itemids = _.map(items, 'itemid').join(', ');
        let table = TREND_TO_TABLE_MAP[value_type];
        let valueColumn = _.includes(['avg', 'min', 'max'], consolidateBy) ? consolidateBy : 'avg';
        valueColumn = consolidateByTrendColumns[valueColumn];

        let query = `
          SELECT itemid AS metric, clock AS time_sec, ${aggFunction}(${valueColumn}) as value
            FROM ${table}
            WHERE itemid IN (${itemids})
              AND clock > ${timeFrom} AND clock < ${timeTill}
            GROUP BY time_sec DIV ${intervalSec}, metric
        `;

        query = compactSQLQuery(query);
        return this.invokeSQLQuery(query);
      });

      return Promise.all(promises).then(results => {
        return _.flatten(results);
      });
    }

    handleGrafanaTSResponse(history, items, addHostName = true) {
      return convertGrafanaTSResponse(history, items, addHostName);
    }

    invokeSQLQuery(query) {
      let queryDef = {
        refId: 'A',
        format: 'time_series',
        datasourceId: this.sqlDataSourceId,
        rawSql: query,
        maxDataPoints: this.limit
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
          return results['A'].series;
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

///////////////////////////////////////////////////////////////////////////////

function convertGrafanaTSResponse(time_series, items, addHostName) {
  var hosts = _.uniqBy(_.flatten(_.map(items, 'hosts')), 'hostid'); //uniqBy is needed to deduplicate
  let grafanaSeries = _.map(time_series, series => {
    let itemid = series.name;
    let datapoints = series.points;
    var item = _.find(items, {'itemid': itemid});
    var alias = item.name;
    if (_.keys(hosts).length > 1 && addHostName) { //only when actual multi hosts selected
      var host = _.find(hosts, {'hostid': item.hostid});
      alias = host.name + ": " + alias;
    }
    return {
      target: alias,
      datapoints: datapoints
    };
  });

  return _.sortBy(grafanaSeries, 'target');
}

function compactSQLQuery(query) {
  return query.replace(/\s+/g, ' ');
}
