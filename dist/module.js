'use strict';

System.register(['./components/config', 'app/plugins/sdk'], function (_export, _context) {
  "use strict";

  var ZabbixAppConfigCtrl, loadPluginCss;
  return {
    setters: [function (_componentsConfig) {
      ZabbixAppConfigCtrl = _componentsConfig.ZabbixAppConfigCtrl;
    }, function (_appPluginsSdk) {
      loadPluginCss = _appPluginsSdk.loadPluginCss;
    }],
    execute: function () {

      loadPluginCss({
        dark: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.dark.css',
        light: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.light.css'
      });

      _export('ConfigCtrl', ZabbixAppConfigCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
