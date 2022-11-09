import { AppPlugin } from '@grafana/data';
import { loadPluginCss } from 'grafana/app/plugins/sdk';

import './sass/grafana-zabbix.dark.scss';
import './sass/grafana-zabbix.light.scss';

loadPluginCss({
  dark: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.dark.css',
  light: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.light.css',
});

export const plugin = new AppPlugin<{}>();
