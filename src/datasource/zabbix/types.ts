export interface ZabbixConnector {
  getHistory: (items, timeFrom, timeTill) => Promise<any>;
  getTrend: (items, timeFrom, timeTill) => Promise<any>;
  getItemsByIDs: (itemids) => Promise<any>;
  getEvents: (objectids, timeFrom, timeTo, showEvents, limit?) => Promise<any>;
  getAlerts: (itemids, timeFrom?, timeTo?) => Promise<any>;
  getHostAlerts: (hostids, applicationids, options?) => Promise<any>;
  getHostICAlerts: (hostids, applicationids, itemids, options?) => Promise<any>;
  getHostPCAlerts: (hostids, applicationids, triggerids, options?) => Promise<any>;
  getAcknowledges: (eventids) => Promise<any>;
  getITService: (serviceids?) => Promise<any>;
  acknowledgeEvent: (eventid, message) => Promise<any>;
  getProxies: () => Promise<any>;
  getEventAlerts: (eventids) => Promise<any>;
  getExtendedEventData: (eventids) => Promise<any>;
  getUserMacros: (hostmacroids) => Promise<any>;
  getMacros: (hostids: any[]) => Promise<any>;
  getVersion: () => Promise<string>;

  getGroups: (groupFilter?) => any;
  getHosts: (groupFilter?, hostFilter?) => any;
  getApps: (groupFilter?, hostFilter?, appFilter?) => any;
  getUMacros: (groupFilter?, hostFilter?, macroFilter?) => any;
  getItems: (groupFilter?, hostFilter?, appFilter?, itemTagFilter?, itemFilter?, options?) => any;
  getSLA: (itservices, timeRange, target, options?) => any;

  supportsApplications: () => boolean;
}
