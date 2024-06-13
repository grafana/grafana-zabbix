import { ZabbixAPIConnector } from './zabbixAPIConnector';

describe('Zabbix API connector', () => {
  describe('getProxies function', () => {
    it('should send the name parameter to the request when version is 7 or greater for the getProxies', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123, '7.0.0');
      zabbixAPIConnector.request = jest.fn();

      await zabbixAPIConnector.getProxies();
      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('proxy.get', { output: ['proxyid', 'name'] });
    });

    it('should send the host parameter when version is less than 7.0.0', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123, '6.0.0');
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getProxies();
      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('proxy.get', { output: ['proxyid', 'host'] });
    });
  });
});
