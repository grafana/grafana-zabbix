import mocks from '../../test-setup/mocks';
import { Zabbix } from './zabbix';

describe('Zabbix', () => {
  let ctx = {};
  let zabbix;
  let options = {
    url: 'http://localhost',
    username: 'zabbix',
    password: 'zabbix',
    zabbixVersion: 4,
  };

  beforeEach(() => {
    ctx.options = options;
    ctx.backendSrv = mocks.backendSrvMock;
    ctx.datasourceSrv = mocks.datasourceSrvMock;
    zabbix = new Zabbix(ctx.options, ctx.backendSrvMock, ctx.datasourceSrvMock);
  });

  describe('When querying proxies', () => {
    beforeEach(() => {
      zabbix.zabbixAPI.getProxies = jest.fn().mockResolvedValue([
        { host: 'proxy-foo', proxyid: '10101' },
        { host: 'proxy-bar', proxyid: '10102' },
      ]);
    });

    it("should return all proxies if filter set to /.*/", done => {
      zabbix.getFilteredProxies('/.*/').then(proxies => {
        expect(proxies).toMatchObject([{ host: 'proxy-foo' }, { host: 'proxy-bar' }]);
        done();
      });
    });

    it("should return matched proxies if regex filter used", done => {
      zabbix.getFilteredProxies('/.*-foo/').then(proxies => {
        expect(proxies).toMatchObject([{ host: 'proxy-foo' }]);
        done();
      });
    });

    it("should return matched proxies if simple filter used", done => {
      zabbix.getFilteredProxies('proxy-bar').then(proxies => {
        expect(proxies).toMatchObject([{ host: 'proxy-bar' }]);
        done();
      });
    });

    it("should return empty list for empty filter", done => {
      zabbix.getFilteredProxies('').then(proxies => {
        expect(proxies).toEqual([]);
        done();
      });
    });
  });

  describe('When filtering triggers by proxy', () => {
    beforeEach(() => {
      zabbix.zabbixAPI.getProxies = jest.fn().mockResolvedValue([
        { host: 'proxy-foo', proxyid: '10101' },
        { host: 'proxy-bar', proxyid: '10102' },
      ]);
      ctx.triggers = [
        { triggerid: '1', hosts: [{ name: 'backend01', proxy_hostid: '0' }] },
        { triggerid: '2', hosts: [{ name: 'backend02', proxy_hostid: '0' }] },
        { triggerid: '3', hosts: [{ name: 'frontend01', proxy_hostid: '10101' }] },
        { triggerid: '4', hosts: [{ name: 'frontend02', proxy_hostid: '10101' }] },
        { triggerid: '5', hosts: [{ name: 'db01', proxy_hostid: '10102' }] },
        { triggerid: '6', hosts: [{ name: 'db02', proxy_hostid: '10102' }] },
      ];
    });

    it("should return all triggers for empty filter", done => {
      zabbix.filterTriggersByProxy(ctx.triggers, '').then(triggers => {
        const triggerids = triggers.map(t => t.triggerid);
        expect(triggerids).toEqual(['1', '2', '3', '4', '5', '6']);
        done();
      });
    });

    it("should return triggers belonging proxy matched regex filter", done => {
      zabbix.filterTriggersByProxy(ctx.triggers, '/.*-foo/').then(triggers => {
        const triggerids = triggers.map(t => t.triggerid);
        expect(triggerids).toEqual(['3', '4']);
        done();
      });
    });

    it("should return triggers belonging proxy matched name filter", done => {
      zabbix.filterTriggersByProxy(ctx.triggers, 'proxy-bar').then(triggers => {
        const triggerids = triggers.map(t => t.triggerid);
        expect(triggerids).toEqual(['5', '6']);
        done();
      });
    });
  });
});
