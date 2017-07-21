'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _angular = require('angular');

var _angular2 = _interopRequireDefault(_angular);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/** @ngInject */
function ZabbixDBConnectorFactory(datasourceSrv, backendSrv) {
  var ZabbixDBConnector = function () {
    function ZabbixDBConnector(sqlDataSourceId) {
      _classCallCheck(this, ZabbixDBConnector);

      this.sqlDataSourceId = sqlDataSourceId;

      // Try to load DS with given id to check it's exist
      this.loadSQLDataSource(sqlDataSourceId);
    }

    _createClass(ZabbixDBConnector, [{
      key: 'loadSQLDataSource',
      value: function loadSQLDataSource(datasourceId) {
        var ds = _lodash2.default.find(datasourceSrv.getAll(), { 'id': datasourceId });
        if (ds) {
          return datasourceSrv.loadDatasource(ds.name).then(function (ds) {
            console.log('SQL data source loaded', ds);
          });
        } else {
          return Promise.reject('SQL Data Source with ID ' + datasourceId + ' not found');
        }
      }
    }, {
      key: 'invokeSQLQuery',
      value: function invokeSQLQuery(query) {
        var queryDef = {
          refId: 'A',
          format: 'table',
          datasourceId: this.sqlDataSourceId,
          rawSql: query
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
            return _lodash2.default.head(results['A'].tables);
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

_angular2.default.module('grafana.services').factory('ZabbixDBConnector', ZabbixDBConnectorFactory);
