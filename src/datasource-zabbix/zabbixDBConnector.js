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

      this.loadSQLDataSource(sqlDataSourceId);
    }

    /**
     * Try to load DS with given id to check it's exist.
     * @param {*} datasourceId ID of SQL data source
     */
    loadSQLDataSource(datasourceId) {
      let ds = _.find(datasourceSrv.getAll(), {'id': datasourceId});
      if (ds) {
        return datasourceSrv.loadDatasource(ds.name)
        .then(ds => {
          this.sqlDataSourceType = ds.meta.id;
          return ds;
        });
      } else {
        return Promise.reject(`SQL Data Source with ID ${datasourceId} not found`);
      }
    }

    /**
     * Try to invoke test query for one of Zabbix database tables.
     */
    testSQLDataSource() {
      let testQuery = TEST_MYSQL_QUERY;
      if (this.sqlDataSourceType === 'postgres') {
        testQuery = TEST_POSTGRES_QUERY;
      }
      return this.invokeSQLQuery(testQuery);
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

        let dialect = this.sqlDataSourceType;
        let query = buildSQLHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, dialect);

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

        let dialect = this.sqlDataSourceType;
        let query = buildSQLTrendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn, dialect);

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
    var item = _.find(items, {'itemid': itemid});
    var alias = item.name;
    if (_.keys(hosts).length > 1 && addHostName) { //only when actual multi hosts selected
      var host = _.find(hosts, {'hostid': item.hostid});
      alias = host.name + ": " + alias;
    }
    // zabbixCachingProxy deduplicates requests and returns one time series for equal queries.
    // Clone is needed to prevent changing of series object shared between all targets.
    let datapoints = _.cloneDeep(series.points);
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

function buildSQLHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, dialect = 'mysql') {
  if (dialect === 'postgres') {
    return buildPostgresHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction);
  } else {
    return buildMysqlHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction);
  }
}

function buildSQLTrendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn, dialect = 'mysql') {
  if (dialect === 'postgres') {
    return buildPostgresTrendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn);
  } else {
    return buildMysqlTrendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn);
  }
}

///////////
// MySQL //
///////////

function buildMysqlHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
  let time_expression = `clock DIV ${intervalSec} * ${intervalSec}`;
  let query = `
    SELECT CAST(itemid AS CHAR) AS metric, ${time_expression} AS time_sec, ${aggFunction}(value) AS value
    FROM ${table}
    WHERE itemid IN (${itemids})
      AND clock > ${timeFrom} AND clock < ${timeTill}
    GROUP BY ${time_expression}, metric
    ORDER BY time_sec ASC
  `;
  return query;
}

function buildMysqlTrendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn) {
  let time_expression = `clock DIV ${intervalSec} * ${intervalSec}`;
  let query = `
    SELECT CAST(itemid AS CHAR) AS metric, ${time_expression} AS time_sec, ${aggFunction}(${valueColumn}) AS value
    FROM ${table}
    WHERE itemid IN (${itemids})
      AND clock > ${timeFrom} AND clock < ${timeTill}
    GROUP BY ${time_expression}, metric
    ORDER BY time_sec ASC
  `;
  return query;
}

const TEST_MYSQL_QUERY = `SELECT CAST(itemid AS CHAR) AS metric, clock AS time_sec, value_avg AS value FROM trends_uint LIMIT 1`;

////////////////
// PostgreSQL //
////////////////

const itemid_format = 'FM99999999999999999999';

function buildPostgresHistoryQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
  let time_expression = `clock / ${intervalSec} * ${intervalSec}`;
  let query = `
    SELECT to_char(itemid, '${itemid_format}') AS metric, ${time_expression} AS time, ${aggFunction}(value) AS value
    FROM ${table}
    WHERE itemid IN (${itemids})
      AND clock > ${timeFrom} AND clock < ${timeTill}
    GROUP BY 1, 2
    ORDER BY time ASC
  `;
  return query;
}

function buildPostgresTrendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn) {
  let time_expression = `clock / ${intervalSec} * ${intervalSec}`;
  let query = `
    SELECT to_char(itemid, '${itemid_format}') AS metric, ${time_expression} AS time, ${aggFunction}(${valueColumn}) AS value
    FROM ${table}
    WHERE itemid IN (${itemids})
      AND clock > ${timeFrom} AND clock < ${timeTill}
    GROUP BY 1, 2
    ORDER BY time ASC
  `;
  return query;
}

const TEST_POSTGRES_QUERY = `
  SELECT to_char(itemid, '${itemid_format}') AS metric, clock AS time, value_avg AS value
  FROM trends_uint LIMIT 1
`;
