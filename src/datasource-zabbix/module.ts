import { DataSourcePlugin } from '@grafana/data';
import { ZabbixDatasource } from './datasource';
import { QueryEditor } from './components/QueryEditor';
import { ZabbixVariableQueryEditor } from './components/VariableQueryEditor';
import { ConfigEditor } from './components/ConfigEditor';

export const plugin = new DataSourcePlugin(ZabbixDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setVariableQueryEditor(ZabbixVariableQueryEditor);
