import { Zabbix } from './zabbix';
import { joinTriggersWithEvents } from '../problemsHandler';
import responseHandler, { handleMultiSLIResponse, handleServiceResponse, handleSLIResponse } from '../responseHandler';

jest.mock('../problemsHandler', () => ({
  joinTriggersWithEvents: jest.fn(),
  joinTriggersWithProblems: jest.fn(),
}));

jest.mock('../responseHandler', () => ({
  __esModule: true,
  default: {
    handleSLAResponse: jest.fn(),
  },
  handleServiceResponse: jest.fn(),
  handleMultiSLIResponse: jest.fn(),
  handleSLIResponse: jest.fn(),
}));

jest.mock(
  '@grafana/runtime',
  () => ({
    getBackendSrv: () => ({
      datasourceRequest: jest.fn().mockResolvedValue({ data: { result: '' } }),
      fetch: () => ({
        toPromise: () => jest.fn().mockResolvedValue({ data: { result: '' } }),
      }),
    }),
  }),
  { virtual: true }
);

describe('Zabbix', () => {
  let consoleSpy: jest.SpyInstance;
  let ctx = {
    options: {
      url: 'http://localhost',
      username: 'zabbix',
      password: 'zabbix',
    },
  };
  let zabbix;

  beforeEach(() => {
    zabbix = new Zabbix(ctx.options);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('When querying proxies', () => {
    beforeEach(() => {
      zabbix.zabbixAPI.getProxies = jest.fn().mockResolvedValue([
        { host: 'proxy-foo', proxyid: '10101' },
        { host: 'proxy-bar', proxyid: '10102' },
      ]);
    });

    it('should return all proxies if filter set to /.*/', (done) => {
      zabbix.getFilteredProxies('/.*/').then((proxies) => {
        expect(proxies).toMatchObject([{ host: 'proxy-foo' }, { host: 'proxy-bar' }]);
        done();
      });
    });

    it('should return matched proxies if regex filter used', (done) => {
      zabbix.getFilteredProxies('/.*-foo/').then((proxies) => {
        expect(proxies).toMatchObject([{ host: 'proxy-foo' }]);
        done();
      });
    });

    it('should return matched proxies if simple filter used', (done) => {
      zabbix.getFilteredProxies('proxy-bar').then((proxies) => {
        expect(proxies).toMatchObject([{ host: 'proxy-bar' }]);
        done();
      });
    });

    it('should return empty list for empty filter', (done) => {
      zabbix.getFilteredProxies('').then((proxies) => {
        expect(proxies).toEqual([]);
        done();
      });
    });
  });

  describe('When filtering triggers by proxy', () => {
    const triggers = [
      { triggerid: '1', hosts: [{ name: 'backend01', proxy_hostid: '0' }] },
      { triggerid: '2', hosts: [{ name: 'backend02', proxy_hostid: '0' }] },
      { triggerid: '3', hosts: [{ name: 'frontend01', proxy_hostid: '10101' }] },
      { triggerid: '4', hosts: [{ name: 'frontend02', proxy_hostid: '10101' }] },
      { triggerid: '5', hosts: [{ name: 'db01', proxy_hostid: '10102' }] },
      { triggerid: '6', hosts: [{ name: 'db02', proxy_hostid: '10102' }] },
    ];
    beforeEach(() => {
      zabbix.zabbixAPI.getProxies = jest.fn().mockResolvedValue([
        { host: 'proxy-foo', proxyid: '10101' },
        { host: 'proxy-bar', proxyid: '10102' },
      ]);
    });

    it('should return all triggers for empty filter', (done) => {
      zabbix.filterTriggersByProxy(triggers, '').then((triggers) => {
        const triggerids = triggers.map((t) => t.triggerid);
        expect(triggerids).toEqual(['1', '2', '3', '4', '5', '6']);
        done();
      });
    });

    it('should return triggers belonging proxy matched regex filter', (done) => {
      zabbix.filterTriggersByProxy(triggers, '/.*-foo/').then((triggers) => {
        const triggerids = triggers.map((t) => t.triggerid);
        expect(triggerids).toEqual(['3', '4']);
        done();
      });
    });

    it('should return triggers belonging proxy matched name filter', (done) => {
      zabbix.filterTriggersByProxy(triggers, 'proxy-bar').then((triggers) => {
        const triggerids = triggers.map((t) => t.triggerid);
        expect(triggerids).toEqual(['5', '6']);
        done();
      });
    });
  });

  describe('getProblemsHistory', () => {
    const ctx = { url: 'http://localhost' };
    let zabbix: Zabbix;

    beforeEach(() => {
      zabbix = new Zabbix(ctx);
      zabbix.getGroups = jest.fn().mockResolvedValue([{ groupid: '21' }]);
      zabbix.getHosts = jest.fn().mockResolvedValue([{ hostid: '31' }]);
      zabbix.getApps = jest.fn().mockResolvedValue([{ applicationid: '41' }]);
      zabbix.supportsApplications = jest.fn().mockReturnValue(true);
      zabbix.zabbixAPI.getEventsHistory = jest.fn().mockResolvedValue([{ objectid: '501' }]);
      zabbix.zabbixAPI.getTriggersByIds = jest.fn().mockResolvedValue([{ triggerid: '501' }]);
      (joinTriggersWithEvents as jest.Mock).mockReturnValue([{ triggerid: '501' }]);
      zabbix.filterTriggersByProxy = jest.fn().mockResolvedValue([{ triggerid: '501' }]);
    });

    it('builds the history query and returns filtered triggers', async () => {
      const result = await zabbix.getProblemsHistory('group.*', 'host.*', 'app.*', 'proxy-foo', {
        valueFromEvent: true,
      });

      expect(zabbix.zabbixAPI.getEventsHistory).toHaveBeenCalledWith(['21'], ['31'], ['41'], { valueFromEvent: true });
      expect(joinTriggersWithEvents).toHaveBeenCalledWith([{ objectid: '501' }], [{ triggerid: '501' }], {
        valueFromEvent: true,
      });
      expect(zabbix.filterTriggersByProxy).toHaveBeenCalledWith([{ triggerid: '501' }], 'proxy-foo');
      expect(result).toEqual([{ triggerid: '501' }]);
    });

    it('omits applicationids when applications are unsupported', async () => {
      (zabbix.supportsApplications as jest.Mock).mockReturnValue(false);

      await zabbix.getProblemsHistory('group.*', 'host.*', 'app.*', undefined, {});

      expect(zabbix.zabbixAPI.getEventsHistory).toHaveBeenCalledWith(['21'], ['31'], undefined, {});
    });
  });

  describe('getSLI', () => {
    it('returns service status when target.slaProperty is status', async () => {
      const itservices = [{ serviceid: '1' }];
      const target = { slaProperty: 'status' } as any;
      const services = [{ serviceid: '1', status: 'ok' }];

      zabbix.zabbixAPI.getServices = jest.fn().mockResolvedValue(services);
      (handleServiceResponse as jest.Mock).mockReturnValue(['status-result']);

      const result = await zabbix.getSLI(itservices, [], [0, 10], target, {}, 'auto');

      expect(zabbix.zabbixAPI.getServices).toHaveBeenCalledWith(['1']);
      expect(handleServiceResponse).toHaveBeenCalledWith(services, itservices, target);
      expect(result).toEqual(['status-result']);
    });

    it('handles multiple SLA ids via handleMultiSLIResponse', async () => {
      const itservices = [{ serviceid: '1' }];
      const slas = [{ slaid: '10' }, { slaid: '20' }];
      const target = { slaProperty: 'sli' } as any;

      zabbix.zabbixAPI.getSLI = jest.fn().mockResolvedValueOnce({ sli: 'a' }).mockResolvedValueOnce({ sli: 'b' });
      (handleMultiSLIResponse as jest.Mock).mockReturnValue(['multi-result']);

      const result = await zabbix.getSLI(itservices, slas, [0, 10], target, {}, 'auto');

      expect(zabbix.zabbixAPI.getSLI).toHaveBeenCalledWith('10', ['1'], [0, 10], {}, 'auto');
      expect(zabbix.zabbixAPI.getSLI).toHaveBeenCalledWith('20', ['1'], [0, 10], {}, 'auto');
      expect(handleMultiSLIResponse).toHaveBeenCalledWith([{ sli: 'a' }, { sli: 'b' }], itservices, slas, target);
      expect(result).toEqual(['multi-result']);
    });

    it('handles single SLA id via handleSLIResponse', async () => {
      const itservices = [{ serviceid: '1' }];
      const slas = [{ slaid: '10' }];
      const target = { slaProperty: 'sli' } as any;

      zabbix.zabbixAPI.getSLI = jest.fn().mockResolvedValue({ sli: 'a' });
      (handleSLIResponse as jest.Mock).mockReturnValue(['single-result']);

      const result = await zabbix.getSLI(itservices, slas, [0, 10], target, {}, 'auto');

      expect(zabbix.zabbixAPI.getSLI).toHaveBeenCalledWith('10', ['1'], [0, 10], {}, 'auto');
      expect(handleSLIResponse).toHaveBeenCalledWith({ sli: 'a' }, itservices, target);
      expect(result).toEqual(['single-result']);
    });
  });

  describe('getSLA', () => {
    it('uses getSLA60 when SLA is supported', async () => {
      const itservices = [{ serviceid: '1' }, { serviceid: '2' }];
      const target = { slaProperty: 'sla' } as any;

      zabbix.supportSLA = jest.fn().mockReturnValue(true);
      zabbix.zabbixAPI.getSLA60 = jest.fn().mockResolvedValue({ sla: [] });
      (responseHandler.handleSLAResponse as jest.Mock).mockImplementation((itservice) => ({
        serviceid: itservice.serviceid,
      }));

      const result = await zabbix.getSLA(itservices, [0, 10], target, 'auto', {});

      expect(zabbix.zabbixAPI.getSLA60).toHaveBeenCalledWith(['1', '2'], [0, 10], {}, 'auto');
      expect(responseHandler.handleSLAResponse).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ serviceid: '1' }, { serviceid: '2' }]);
    });

    it('uses getSLA when SLA is not supported', async () => {
      const itservices = [{ serviceid: '1' }];
      const target = { slaProperty: 'sla' } as any;

      zabbix.supportSLA = jest.fn().mockReturnValue(false);
      zabbix.zabbixAPI.getSLA = jest.fn().mockResolvedValue({ sla: [] });
      (responseHandler.handleSLAResponse as jest.Mock).mockReturnValue({ serviceid: '1' });

      const result = await zabbix.getSLA(itservices, [0, 10], target, 'auto', {});

      expect(zabbix.zabbixAPI.getSLA).toHaveBeenCalledWith(['1'], [0, 10], {}, 'auto');
      expect(responseHandler.handleSLAResponse).toHaveBeenCalledWith(itservices[0], 'sla', { sla: [] });
      expect(result).toEqual([{ serviceid: '1' }]);
    });
  });
});
