'use strict';

System.register(['lodash'], function (_export, _context) {
  "use strict";

  var _, _createClass, SUPPORTED_SQL_DS, defaultConfig, ZabbixDSConfigController;

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

      SUPPORTED_SQL_DS = ['mysql', 'postgres'];
      defaultConfig = {
        dbConnection: {
          enable: false
        }
      };

      _export('ZabbixDSConfigController', ZabbixDSConfigController = function () {
        /** @ngInject */
        function ZabbixDSConfigController($scope, $injector, datasourceSrv) {
          _classCallCheck(this, ZabbixDSConfigController);

          this.datasourceSrv = datasourceSrv;

          _.defaults(this.current.jsonData, defaultConfig);
          this.sqlDataSources = this.getSupportedSQLDataSources();
        }

        _createClass(ZabbixDSConfigController, [{
          key: 'getSupportedSQLDataSources',
          value: function getSupportedSQLDataSources() {
            var datasources = this.datasourceSrv.getAll();
            return _.filter(datasources, function (ds) {
              return _.includes(SUPPORTED_SQL_DS, ds.type);
            });
          }
        }]);

        return ZabbixDSConfigController;
      }());

      _export('ZabbixDSConfigController', ZabbixDSConfigController);

      ZabbixDSConfigController.templateUrl = 'datasource-zabbix/partials/config.html';
    }
  };
});
//# sourceMappingURL=config.controller.js.map
