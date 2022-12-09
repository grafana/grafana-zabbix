import { AppPlugin } from '@grafana/data';
import { loadPluginCss } from 'grafana/app/plugins/sdk';

loadPluginCss({
  dark: 'plugins/alexanderzobnin-zabbix-app/styles/dark.css',
  light: 'plugins/alexanderzobnin-zabbix-app/styles/light.css',
});

export const plugin = new AppPlugin<{}>();
