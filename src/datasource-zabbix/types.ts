export interface VariableQuery {
  queryType: MetricFindQueryTypes;
  group?: string;
  host?: string;
  application?: string;
  item?: string;
}

export enum MetricFindQueryTypes {
  Group = 'group',
  Host = 'host',
  Application = 'application',
  Item = 'item',
}
