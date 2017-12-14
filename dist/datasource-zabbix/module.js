'use strict';

System.register(['app/plugins/sdk', './datasource', './query.controller', './config.controller'], function (_export, _context) {
  "use strict";

  var loadPluginCss, ZabbixAPIDatasource, ZabbixQueryController, ZabbixDSConfigController, ZabbixQueryOptionsController, ZabbixAnnotationsQueryController;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_appPluginsSdk) {
      loadPluginCss = _appPluginsSdk.loadPluginCss;
    }, function (_datasource) {
      ZabbixAPIDatasource = _datasource.ZabbixAPIDatasource;
    }, function (_queryController) {
      ZabbixQueryController = _queryController.ZabbixQueryController;
    }, function (_configController) {
      ZabbixDSConfigController = _configController.ZabbixDSConfigController;
    }],
    execute: function () {

      loadPluginCss({
        dark: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.dark.css',
        light: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.light.css'
      });

      _export('QueryOptionsCtrl', ZabbixQueryOptionsController = function ZabbixQueryOptionsController() {
        _classCallCheck(this, ZabbixQueryOptionsController);
      });

      ZabbixQueryOptionsController.templateUrl = 'datasource-zabbix/partials/query.options.html';

      _export('AnnotationsQueryCtrl', ZabbixAnnotationsQueryController = function ZabbixAnnotationsQueryController() {
        _classCallCheck(this, ZabbixAnnotationsQueryController);
      });

      ZabbixAnnotationsQueryController.templateUrl = 'datasource-zabbix/partials/annotations.editor.html';

      _export('Datasource', ZabbixAPIDatasource);

      _export('ConfigCtrl', ZabbixDSConfigController);

      _export('QueryCtrl', ZabbixQueryController);

      _export('QueryOptionsCtrl', ZabbixQueryOptionsController);

      _export('AnnotationsQueryCtrl', ZabbixAnnotationsQueryController);
    }
  };
});
//# sourceMappingURL=module.js.map
