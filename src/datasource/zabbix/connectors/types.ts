export interface InfluxDBConnectorOptions {
  retentionPolicy: string;
}

export interface SQLConnectorOptions {
  limit?: number;
}

export interface ClickHouseConnectorOptions {
  limit?: number;
}
