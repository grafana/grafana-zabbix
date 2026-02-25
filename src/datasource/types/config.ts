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
  timeout?: number;
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
  // Disabling as we still need this for migration purposes for now.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  dbConnection?: OldDBConnection;
  /** @deprecated
   * Use `dbConnectionDatasourceUID` instead.
   * Currently only used to support migration for older schemas.
   * */
  // Disabling as we still need this for migration purposes for now.
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
