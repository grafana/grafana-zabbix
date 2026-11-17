import { DataSourceJsonData } from '@grafana/data';

export enum ZabbixAuthType {
  UserLogin = 'userLogin',
  Token = 'token',
}

export type ZabbixDSOptions = {
  authType?: ZabbixAuthType;
  username: string;
  password?: string;
  trends: boolean;
  trendsFrom: string;
  trendsRange: string;
  cacheTTL: string;
  timeout?: number | string;
  queryTimeout?: number;
  dbConnectionEnable: boolean;
  dbConnectionDatasourceUID?: string;
  dbConnectionDatasourceName?: string;
  dbConnectionRetentionPolicy?: string;
  disableReadOnlyUsersAck: boolean;
  disableDataAlignment: boolean;
  enableSecureSocksProxy?: boolean;
  /** @deprecated
   * Use `dbConnectionEnable` `dbConnectionDatasourceUID` `dbConnectionDatasourceName` `dbConnectionRetentionPolicy` instead.
   * Currently only used to support migration for older schemas.
   * */
  dbConnection?: OldDBConnection;
  /** @deprecated
   * Use `dbConnectionDatasourceUID` instead.
   * Currently only used to support migration for older schemas.
   * */
  dbConnectionDatasourceId?: number;
  schema?: number;
  perUserAuth?: boolean;
  perUserAuthField?: 'username' | 'email';
  perUserAuthExcludeUsers?: string[];
  /**
   * Global overrides for the problem severity names and colors used by Problems panels
   * that query this data source. Entries only need to set the fields they override;
   * unset fields keep the plugin defaults. Panels that already have their own custom
   * name or color for a severity keep it.
   */
  severityOverrides?: SeverityOverride[];
} & DataSourceJsonData;

export interface SeverityOverride {
  /** Zabbix severity priority: 0 (Not classified) .. 5 (Disaster) */
  priority: number;
  /** Severity name to display. Empty or unset keeps the default. */
  name?: string;
  /** Severity color. Empty or unset keeps the default. */
  color?: string;
}

/** @deprecated
 * Use `dbConnectionEnable` `dbConnectionDatasourceUID` `dbConnectionDatasourceName` `dbConnectionRetentionPolicy` instead.
 * Currently only used to support migration for older schemas.
 * */
interface OldDBConnection {
  enable: boolean;
  datasourceId: number;
}

type ZabbixSecureJSONDataKeys = 'password' | 'apiToken';

export type ZabbixSecureJSONData = Partial<Record<ZabbixSecureJSONDataKeys, string>>;
