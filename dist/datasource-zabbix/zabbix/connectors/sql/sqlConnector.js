'use strict';

System.register(['lodash', './mysql', './postgres', '../dbConnector'], function (_export, _context) {
  "use strict";

  var _, mysql, postgres, DBConnector, _createClass, _get, supportedDatabases, DEFAULT_QUERY_LIMIT, HISTORY_TO_TABLE_MAP, TREND_TO_TABLE_MAP, consolidateByFunc, consolidateByTrendColumns, SQLConnector;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  ///////////////////////////////////////////////////////////////////////////////

  function convertGrafanaTSResponse(time_series, items, addHostName) {
    //uniqBy is needed to deduplicate
    var hosts = _.uniqBy(_.flatten(_.map(items, 'hosts')), 'hostid');
    var grafanaSeries = _.map(time_series, function (series) {
      var itemid = series.name;
      var item = _.find(items, { 'itemid': itemid });
      var alias = item.name;
      //only when actual multi hosts selected
      if (_.keys(hosts).length > 1 && addHostName) {
        var host = _.find(hosts, { 'hostid': item.hostid });
        alias = host.name + ": " + alias;
      }
      // CachingProxy deduplicates requests and returns one time series for equal queries.
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
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_mysql) {
      mysql = _mysql.default;
    }, function (_postgres) {
      postgres = _postgres.default;
    }, function (_dbConnector) {
      DBConnector = _dbConnector.default;
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

      _get = function get(object, property, receiver) {
        if (object === null) object = Function.prototype;
        var desc = Object.getOwnPropertyDescriptor(object, property);

        if (desc === undefined) {
          var parent = Object.getPrototypeOf(object);

          if (parent === null) {
            return undefined;
          } else {
            return get(parent, property, receiver);
          }
        } else if ("value" in desc) {
          return desc.value;
        } else {
          var getter = desc.get;

          if (getter === undefined) {
            return undefined;
          }

          return getter.call(receiver);
        }
      };

      supportedDatabases = {
        mysql: 'mysql',
        postgres: 'postgres'
      };
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

      _export('SQLConnector', SQLConnector = function (_DBConnector) {
        _inherits(SQLConnector, _DBConnector);

        function SQLConnector(options, backendSrv, datasourceSrv) {
          _classCallCheck(this, SQLConnector);

          var _this = _possibleConstructorReturn(this, (SQLConnector.__proto__ || Object.getPrototypeOf(SQLConnector)).call(this, options, backendSrv, datasourceSrv));

          _this.limit = options.limit || DEFAULT_QUERY_LIMIT;
          _this.sqlDialect = null;

          _get(SQLConnector.prototype.__proto__ || Object.getPrototypeOf(SQLConnector.prototype), 'loadDBDataSource', _this).call(_this).then(function () {
            return _this.loadSQLDialect();
          });
          return _this;
        }

        _createClass(SQLConnector, [{
          key: 'loadSQLDialect',
          value: function loadSQLDialect() {
            if (this.datasourceTypeId === supportedDatabases.postgres) {
              this.sqlDialect = postgres;
            } else {
              this.sqlDialect = mysql;
            }
          }
        }, {
          key: 'testDataSource',
          value: function testDataSource() {
            var testQuery = this.sqlDialect.testQuery();
            return this.invokeSQLQuery(testQuery);
          }
        }, {
          key: 'getHistory',
          value: function getHistory(items, timeFrom, timeTill, options) {
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
              var table = HISTORY_TO_TABLE_MAP[value_type];
              var query = _this2.sqlDialect.historyQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction);

              query = compactSQLQuery(query);
              return _this2.invokeSQLQuery(query);
            });

            return Promise.all(promises).then(function (results) {
              return _.flatten(results);
            });
          }
        }, {
          key: 'getTrends',
          value: function getTrends(items, timeFrom, timeTill, options) {
            var _this3 = this;

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
              var query = _this3.sqlDialect.trendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn);

              query = compactSQLQuery(query);
              return _this3.invokeSQLQuery(query);
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
              datasourceId: this.datasourceId,
              rawSql: query,
              maxDataPoints: this.limit
            };

            return this.backendSrv.datasourceRequest({
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

        return SQLConnector;
      }(DBConnector));

      _export('SQLConnector', SQLConnector);
    }
  };
});
//# sourceMappingURL=sqlConnector.js.map
