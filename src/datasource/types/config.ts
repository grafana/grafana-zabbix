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
  dbConnectionEnable: boolean;
  dbConnectionDatasourceId?: number;
  dbConnectionDatasourceName?: string;
  dbConnectionRetentionPolicy?: string;
  disableReadOnlyUsersAck: boolean;
  disableDataAlignment: boolean;
  enableSecureSocksProxy?: boolean;
} & DataSourceJsonData;

type ZabbixSecureJSONDataKeys = 'password' | 'apiToken';

export type ZabbixSecureJSONData = Partial<Record<ZabbixSecureJSONDataKeys, string>>;
