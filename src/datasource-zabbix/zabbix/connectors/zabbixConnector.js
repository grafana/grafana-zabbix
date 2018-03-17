/**
 * Base class for all Zabbix connectors
 */

export default class ZabbixConnector {

  constructor() {}

  testDataSource() {}

  getHistory() {}

  getTrends() {}

  getGroups() {}

  getHosts() {}

  getApps() {}

  getItems() {}

  getItemsByIDs() {}

  getMacros() {}

  getGlobalMacros() {}

  getLastValue() {}

  getTriggers() {}

  getEvents() {}

  getAlerts() {}

  getHostAlerts() {}

  getAcknowledges() {}

  getITService() {}

  getSLA() {}

  getVersion() {}
}
