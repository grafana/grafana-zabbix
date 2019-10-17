import { DataQuery } from '@grafana/ui';

export interface ZabbixConnectionInfo {
  zabbixVersion: string;
  dbConnectorStatus: {
    dsType: string;
    dsName: string;
  };
}

export interface ZabbixConnectionTestQuery {
  datasourceId: number;
  queryType: string;
}

export interface ZabbixMetricsQuery extends DataQuery {
  triggers: { minSeverity: string; acknowledged: boolean; count: number; };
  queryType: string;
  datasourceId: number;
  functions: { name: string; params: any; def: { name: string; params: any; } }[];
  options: any;
  textFilter: string;
  mode: number;
  itemids: number[];
  useCaptureGroups: boolean;
  group: { filter: string; name: string; };
  host: { filter: string; name: string; };
  hostFilter: string;
  application: { filter: string; name: string; };
  item: { filter: string; name: string; };
  itemFilter: string;
}

export { TemplateSrv } from 'grafana/app/features/templating/template_srv';
export { DashboardSrv } from 'grafana/app/features/dashboard/dashboard_srv';
