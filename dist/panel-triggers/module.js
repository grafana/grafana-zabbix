'use strict';

System.register(['./triggers_panel_ctrl', 'app/plugins/sdk', './datasource-selector.directive', './ack-tooltip.directive'], function (_export, _context) {
  "use strict";

  var TriggerPanelCtrl, loadPluginCss;
  return {
    setters: [function (_triggers_panel_ctrl) {
      TriggerPanelCtrl = _triggers_panel_ctrl.TriggerPanelCtrl;
    }, function (_appPluginsSdk) {
      loadPluginCss = _appPluginsSdk.loadPluginCss;
    }, function (_datasourceSelectorDirective) {}, function (_ackTooltipDirective) {}],
    execute: function () {
      /**
       * Grafana-Zabbix
       * Zabbix plugin for Grafana.
       * http://github.com/alexanderzobnin/grafana-zabbix
       *
       * Trigger panel.
       * This feature sponsored by CORE IT
       * http://www.coreit.fr
       *
       * Copyright 2015 Alexander Zobnin alexanderzobnin@gmail.com
       * Licensed under the Apache License, Version 2.0
       */

      loadPluginCss({
        dark: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.dark.css',
        light: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.light.css'
      });

      _export('PanelCtrl', TriggerPanelCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
