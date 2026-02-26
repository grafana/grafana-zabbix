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
   * Use `dbConnectionUID` instead.
   * Currently only used to support migration for older schemas.
   * */
  dbConnectionDatasourceId?: number;
  schema?: number;
} & DataSourceJsonData;

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
