import { DataSourcePlugin } from '@grafana/data';
import { loadPluginCss } from '@grafana/runtime';
import { ZabbixDatasource } from './datasource';
import { QueryEditor } from './components/QueryEditor';
import { ZabbixVariableQueryEditor } from './components/VariableQueryEditor';
import { ConfigEditor } from './components/ConfigEditor';
import '../sass/grafana-zabbix.dark.scss';
import '../sass/grafana-zabbix.light.scss';

class ZabbixAnnotationsQueryController {
  static templateUrl = 'datasource-zabbix/partials/annotations.editor.html';
}

loadPluginCss({
  dark: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.dark.css',
  light: 'plugins/alexanderzobnin-zabbix-app/css/grafana-zabbix.light.css',
});

export const plugin = new DataSourcePlugin(ZabbixDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setAnnotationQueryCtrl(ZabbixAnnotationsQueryController)
  .setVariableQueryEditor(ZabbixVariableQueryEditor);
