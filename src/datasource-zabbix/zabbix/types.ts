export interface ZabbixConnector {
  getMacros(hostids: any[]): any;
  getVersion(): string;
  login(): any;
}
