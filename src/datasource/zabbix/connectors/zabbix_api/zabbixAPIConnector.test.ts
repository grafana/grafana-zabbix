import { ZabbixAPIConnector } from './zabbixAPIConnector';

describe('Zabbix API connector', () => {
  describe('getProxies function', () => {
    beforeAll(() => {
      jest.spyOn(ZabbixAPIConnector.prototype, 'initVersion').mockResolvedValue('');
    });

    it('should send the name parameter to the request when version is 7 or greater for the getProxies', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '7.0.0';
      zabbixAPIConnector.request = jest.fn();

      await zabbixAPIConnector.getProxies();
      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('proxy.get', { output: ['proxyid', 'name'] });
    });

    it('should send the host parameter when version is less than 7.0.0', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '6.0.0';
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getProxies();
      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('proxy.get', { output: ['proxyid', 'host'] });
    });

    it('should send the with_hosts parameter when version is 7.2+', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '7.2.0';
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getGroups();
      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('hostgroup.get', {
        output: ['name', 'groupid'],
        sortfield: 'name',
        with_hosts: true,
      });
    });

    it('should send the real_hosts parameter when version is <7.2', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '7.1.0';
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getGroups();
      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('hostgroup.get', {
        output: ['name', 'groupid'],
        sortfield: 'name',
        real_hosts: true,
      });
    });
  });
});
