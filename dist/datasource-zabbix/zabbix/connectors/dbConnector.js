'use strict';

System.register(['lodash'], function (_export, _context) {
  "use strict";

  var _, _createClass, DBConnector, ZabbixNotImplemented;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
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

      DBConnector = function () {
        function DBConnector(options, backendSrv, datasourceSrv) {
          _classCallCheck(this, DBConnector);

          this.backendSrv = backendSrv;
          this.datasourceSrv = datasourceSrv;
          this.datasourceId = options.datasourceId;
          this.datasourceName = options.datasourceName;
          this.datasourceTypeId = null;
          this.datasourceTypeName = null;
        }

        _createClass(DBConnector, [{
          key: 'loadDBDataSource',
          value: function loadDBDataSource() {
            var _this = this;

            var ds = _.find(this.datasourceSrv.getAll(), { 'id': this.datasourceId });
            if (ds) {
              return this.datasourceSrv.loadDatasource(ds.name).then(function (ds) {
                _this.datasourceName = ds.name;
                _this.datasourceTypeId = ds.meta.id;
                _this.datasourceTypeName = ds.meta.name;
                return ds;
              });
            } else {
              return Promise.reject('SQL Data Source with ID ' + this.datasourceId + ' not found');
            }
          }
        }, {
          key: 'testDataSource',
          value: function testDataSource() {
            throw new ZabbixNotImplemented('testDataSource()');
          }
        }, {
          key: 'getHistory',
          value: function getHistory() {
            throw new ZabbixNotImplemented('getHistory()');
          }
        }, {
          key: 'getTrends',
          value: function getTrends() {
            throw new ZabbixNotImplemented('getTrends()');
          }
        }]);

        return DBConnector;
      }();

      _export('default', DBConnector);

      _export('ZabbixNotImplemented', ZabbixNotImplemented = function () {
        function ZabbixNotImplemented(methodName) {
          _classCallCheck(this, ZabbixNotImplemented);

          this.code = null;
          this.name = 'ZabbixNotImplemented';
          this.message = 'Zabbix DB Connector Error: method ' + (methodName || '') + ' should be implemented in subclass of DBConnector';
        }

        _createClass(ZabbixNotImplemented, [{
          key: 'toString',
          value: function toString() {
            return this.message;
          }
        }]);

        return ZabbixNotImplemented;
      }());

      _export('ZabbixNotImplemented', ZabbixNotImplemented);
    }
  };
});
//# sourceMappingURL=dbConnector.js.map
