export interface ConnectorOptions {
  datasourceUID: string;
  datasourceName: string;
}

export interface InfluxDBConnectorOptions extends ConnectorOptions {
  retentionPolicy: string;
}

export interface SQLConnectorOptions extends ConnectorOptions {
  limit?: number;
}
