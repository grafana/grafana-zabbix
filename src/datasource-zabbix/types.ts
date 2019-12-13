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

// export { TemplateSrv } from 'grafana/app/features/templating/template_srv';
// export { DashboardSrv } from 'grafana/app/features/dashboard/dashboard_srv';

// The paths of these files have moved around in Grafana and they don't resolve properly
// either. Safer not to bother trying to import them just for type hinting.

export interface TemplateSrv {
  variables: {
    name: string;
  };
  highlightVariablesAsHtml(str: any): any;
  replace(target: any, scopedVars?: any, format?: any): any;
}

export interface DashboardSrv {
  dash: any
}

// Grafana types from backend code

type RowValues = object[];
type TimePoint = [number?, number?];
type TimeSeriesPoints = TimePoint[];
type TimeSeriesSlice = TimeSeries[];

interface TimeSeries {
	name: string;
	points: TimeSeriesPoints;
	tags: { [key: string]: string };
}

interface TableColumn {
	text: string;
}

interface Table {
	columns: TableColumn[];
	rows: RowValues[];
}

interface QueryResult {
	error: string;
	refId: string;
	meta: any;
	series: TimeSeriesSlice[];
	tables: Table[];
}

export interface TSDBResponse {
	results: { [key: string]: QueryResult };
	message: string;
}
