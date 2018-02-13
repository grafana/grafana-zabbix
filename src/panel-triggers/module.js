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

import {TriggerPanelCtrl} from './triggers_panel_ctrl';
import {loadPluginCss} from 'app/plugins/sdk';
import './datasource-selector.directive';
import './ack-tooltip.directive';

loadPluginCss({
  dark: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.dark.css',
  light: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.light.css'
});

export {
  TriggerPanelCtrl as PanelCtrl
};
