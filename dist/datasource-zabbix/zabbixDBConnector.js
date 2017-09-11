'use strict';

System.register(['angular', 'lodash'], function (_export, _context) {
  "use strict";

  var angular, _, _createClass, DEFAULT_QUERY_LIMIT, HISTORY_TO_TABLE_MAP, TREND_TO_TABLE_MAP, consolidateByFunc, consolidateByTrendColumns;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  /** @ngInject */
  function ZabbixDBConnectorFactory(datasourceSrv, backendSrv) {
    var ZabbixDBConnector = function () {
      function ZabbixDBConnector(sqlDataSourceId) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        _classCallCheck(this, ZabbixDBConnector);

        var limit = options.limit;


        this.sqlDataSourceId = sqlDataSourceId;
        this.limit = limit || DEFAULT_QUERY_LIMIT;
      }

      /**
       * Try to load DS with given id to check it's exist.
       * @param {*} datasourceId ID of SQL data source
       */


      _createClass(ZabbixDBConnector, [{
        key: 'loadSQLDataSource',
        value: function loadSQLDataSource(datasourceId) {
          var ds = _.find(datasourceSrv.getAll(), { 'id': datasourceId });
          if (ds) {
            return datasourceSrv.loadDatasource(ds.name).then(function (ds) {
              console.log('SQL data source loaded', ds);
            });
          } else {
            return Promise.reject('SQL Data Source with ID ' + datasourceId + ' not found');
          }
        }
      }, {
        key: 'testSQLDataSource',
        value: function testSQLDataSource() {
          var testQuery = 'SELECT itemid AS metric, clock AS time_sec, value_avg AS value FROM trends_uint LIMIT 1';
          return this.invokeSQLQuery(testQuery);
        }
      }, {
        key: 'getHistory',
        value: function getHistory(items, timeFrom, timeTill, options) {
          var _this = this;

          var intervalMs = options.intervalMs,
              consolidateBy = options.consolidateBy;

          var intervalSec = Math.ceil(intervalMs / 1000);

          consolidateBy = consolidateBy || 'avg';
          var aggFunction = consolidateByFunc[consolidateBy];

          // Group items by value type and perform request for each value type
          var grouped_items = _.groupBy(items, 'value_type');
          var promises = _.map(grouped_items, function (items, value_type) {
            var itemids = _.map(items, 'itemid').join(', ');
            var table = HISTORY_TO_TABLE_MAP[value_type];

            var time_expression = 'clock DIV ' + intervalSec + ' * ' + intervalSec;
            var query = '\n          SELECT itemid AS metric, ' + time_expression + ' AS time_sec, ' + aggFunction + '(value) AS value\n            FROM ' + table + '\n            WHERE itemid IN (' + itemids + ')\n              AND clock > ' + timeFrom + ' AND clock < ' + timeTill + '\n            GROUP BY ' + time_expression + ', metric\n        ';

            query = compactSQLQuery(query);
            return _this.invokeSQLQuery(query);
          });

          return Promise.all(promises).then(function (results) {
            return _.flatten(results);
          });
        }
      }, {
        key: 'getTrends',
        value: function getTrends(items, timeFrom, timeTill, options) {
          var _this2 = this;

          var intervalMs = options.intervalMs,
              consolidateBy = options.consolidateBy;

          var intervalSec = Math.ceil(intervalMs / 1000);

          consolidateBy = consolidateBy || 'avg';
          var aggFunction = consolidateByFunc[consolidateBy];

          // Group items by value type and perform request for each value type
          var grouped_items = _.groupBy(items, 'value_type');
          var promises = _.map(grouped_items, function (items, value_type) {
            var itemids = _.map(items, 'itemid').join(', ');
            var table = TREND_TO_TABLE_MAP[value_type];
            var valueColumn = _.includes(['avg', 'min', 'max'], consolidateBy) ? consolidateBy : 'avg';
            valueColumn = consolidateByTrendColumns[valueColumn];

            var time_expression = 'clock DIV ' + intervalSec + ' * ' + intervalSec;
            var query = '\n          SELECT itemid AS metric, ' + time_expression + ' AS time_sec, ' + aggFunction + '(' + valueColumn + ') AS value\n            FROM ' + table + '\n            WHERE itemid IN (' + itemids + ')\n              AND clock > ' + timeFrom + ' AND clock < ' + timeTill + '\n            GROUP BY ' + time_expression + ', metric\n        ';

            query = compactSQLQuery(query);
            return _this2.invokeSQLQuery(query);
          });

          return Promise.all(promises).then(function (results) {
            return _.flatten(results);
          });
        }
      }, {
        key: 'handleGrafanaTSResponse',
        value: function handleGrafanaTSResponse(history, items) {
          var addHostName = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

          return convertGrafanaTSResponse(history, items, addHostName);
        }
      }, {
        key: 'invokeSQLQuery',
        value: function invokeSQLQuery(query) {
          var queryDef = {
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
              queries: [queryDef]
            }
          }).then(function (response) {
            var results = response.data.results;
            if (results['A']) {
              return results['A'].series;
            } else {
              return null;
            }
          });
        }
      }]);

      return ZabbixDBConnector;
    }();

    return ZabbixDBConnector;
  }

  ///////////////////////////////////////////////////////////////////////////////

  function convertGrafanaTSResponse(time_series, items, addHostName) {
    var hosts = _.uniqBy(_.flatten(_.map(items, 'hosts')), 'hostid'); //uniqBy is needed to deduplicate
    var grafanaSeries = _.map(time_series, function (series) {
      var itemid = series.name;
      var item = _.find(items, { 'itemid': itemid });
      var alias = item.name;
      if (_.keys(hosts).length > 1 && addHostName) {
        //only when actual multi hosts selected
        var host = _.find(hosts, { 'hostid': item.hostid });
        alias = host.name + ": " + alias;
      }
      // zabbixCachingProxy deduplicates requests and returns one time series for equal queries.
      // Clone is needed to prevent changing of series object shared between all targets.
      var datapoints = _.cloneDeep(series.points);
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
  return {
    setters: [function (_angular) {
      angular = _angular.default;
    }, function (_lodash) {
      _ = _lodash.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      DEFAULT_QUERY_LIMIT = 10000;
      HISTORY_TO_TABLE_MAP = {
        '0': 'history',
        '1': 'history_str',
        '2': 'history_log',
        '3': 'history_uint',
        '4': 'history_text'
      };
      TREND_TO_TABLE_MAP = {
        '0': 'trends',
        '3': 'trends_uint'
      };
      consolidateByFunc = {
        'avg': 'AVG',
        'min': 'MIN',
        'max': 'MAX',
        'sum': 'SUM',
        'count': 'COUNT'
      };
      consolidateByTrendColumns = {
        'avg': 'value_avg',
        'min': 'value_min',
        'max': 'value_max'
      };
      angular.module('grafana.services').factory('ZabbixDBConnector', ZabbixDBConnectorFactory);
    }
  };
});
//# sourceMappingURL=zabbixDBConnector.js.map
