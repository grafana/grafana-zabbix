'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ZabbixDSConfigController = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SUPPORTED_SQL_DS = ['mysql', 'postgres'];

var defaultConfig = {
  dbConnection: {
    enable: false
  }
};

var ZabbixDSConfigController = exports.ZabbixDSConfigController = function () {
  /** @ngInject */
  function ZabbixDSConfigController($scope, $injector, datasourceSrv) {
    _classCallCheck(this, ZabbixDSConfigController);

    this.datasourceSrv = datasourceSrv;

    _lodash2.default.defaults(this.current.jsonData, defaultConfig);
    this.sqlDataSources = this.getSupportedSQLDataSources();
  }

  _createClass(ZabbixDSConfigController, [{
    key: 'getSupportedSQLDataSources',
    value: function getSupportedSQLDataSources() {
      var datasources = this.datasourceSrv.getAll();
      return _lodash2.default.filter(datasources, function (ds) {
        return _lodash2.default.includes(SUPPORTED_SQL_DS, ds.type);
      });
    }
  }]);

  return ZabbixDSConfigController;
}();

ZabbixDSConfigController.templateUrl = 'datasource-zabbix/partials/config.html';
