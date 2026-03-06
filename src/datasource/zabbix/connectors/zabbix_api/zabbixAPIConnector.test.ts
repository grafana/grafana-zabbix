import { ZabbixAPIConnector } from './zabbixAPIConnector';
import { HostTagOperatorValue } from '../../../components/QueryEditor/types';
import { ZabbixTagEvalType } from 'datasource/types/query';

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

    it('should send the with_hosts parameter when version is 7.0+', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '7.0.0';
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getGroups();
      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('hostgroup.get', {
        output: ['name', 'groupid'],
        sortfield: 'name',
        with_hosts: true,
      });
    });

    it('should send the real_hosts parameter when version is <=6.0', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '6.0.0';
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getGroups();
      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('hostgroup.get', {
        output: ['name', 'groupid'],
        sortfield: 'name',
        real_hosts: true,
      });
    });

    it('should send the with_hosts parameter when version is >=6.2', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '6.2.0';
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getGroups();
      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('hostgroup.get', {
        output: ['name', 'groupid'],
        sortfield: 'name',
        with_hosts: true,
      });
    });
  });

  describe('getHostAlerts function', () => {
    it('should return number when count is enabled and acknowledged is 1 and version is 7 or greater', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '7.0.0';
      zabbixAPIConnector.request = jest.fn(() => Promise.resolve(triggers));

      const result = await zabbixAPIConnector.getHostAlerts(undefined, undefined, { count: true, acknowledged: 1 });
      expect(result).toBe(0);
    });
  });

  describe('getHostICAlerts function', () => {
    it('should return number when count is enabled and acknowledged is 1 and version is 7 or greater', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '7.0.0';
      zabbixAPIConnector.request = jest.fn(() => Promise.resolve(triggers));

      const result = await zabbixAPIConnector.getHostICAlerts(undefined, undefined, undefined, {
        count: true,
        acknowledged: 1,
      });
      expect(result).toBe(0);
    });
  });

  describe('getHostPCAlerts function', () => {
    it('should return number when count is enabled and acknowledged is 1 and version is 7 or greater', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '7.0.0';
      zabbixAPIConnector.request = jest.fn(() => Promise.resolve(triggers));

      const result = await zabbixAPIConnector.getHostPCAlerts(undefined, undefined, undefined, {
        count: true,
        acknowledged: 1,
      });
      expect(result).toBe(0);
    });
  });

  describe('getProblems', () => {
    it('sends full filter payload with application ids when supported', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '7.0.0';
      zabbixAPIConnector.request = jest.fn(() => Promise.resolve([{ eventid: '1' }]));

      await zabbixAPIConnector.getProblems(['21'], ['31'], ['41'], true, {
        timeFrom: 100,
        timeTo: 200,
        recent: 'true',
        severities: [3, 4],
        limit: 50,
        acknowledged: 0,
        tags: [{ tag: 'service', value: 'foo' }],
        evaltype: 1,
      });

      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('problem.get', {
        output: 'extend',
        selectAcknowledges: 'extend',
        selectSuppressionData: 'extend',
        selectTags: 'extend',
        source: '0',
        object: '0',
        sortfield: ['eventid'],
        sortorder: 'DESC',
        evaltype: 1,
        groupids: ['21'],
        hostids: ['31'],
        applicationids: ['41'],
        recent: 'true',
        severities: [3, 4],
        acknowledged: 0,
        tags: [{ tag: 'service', value: 'foo' }],
        limit: 50,
        time_from: 100,
        time_till: 200,
      });
    });

    it('omits applicationids when applications are unsupported', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.version = '7.0.0';
      zabbixAPIConnector.request = jest.fn(() => Promise.resolve([{ eventid: '1' }]));

      await zabbixAPIConnector.getProblems(['21'], ['31'], ['41'], false, {});

      const [, params] = (zabbixAPIConnector.request as jest.Mock).mock.calls.at(-1)!;
      expect(params.applicationids).toBeUndefined();
    });
  });

  describe('getHosts', () => {
    it('passes base params and group ids', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getHosts(['1', '2']);

      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('host.get', {
        output: ['hostid', 'name', 'host'],
        sortfield: 'name',
        groupids: ['1', '2'],
      });
    });

    it('requests tags when getHostTags is true', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getHosts(undefined, true);

      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('host.get', {
        output: ['hostid', 'name', 'host', 'tags'],
        sortfield: 'name',
        selectTags: 'extend',
      });
    });

    it('builds tag filters with numeric operator and evaltype', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getHosts(
        undefined,
        false,
        [
          { tag: 'role', value: 'api', operator: HostTagOperatorValue.Contains },
          { tag: '', value: 'ignore me', operator: HostTagOperatorValue.Equals },
        ],
        ZabbixTagEvalType.Or
      );

      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('host.get', {
        output: ['hostid', 'name', 'host'],
        sortfield: 'name',
        selectTags: 'extend',
        evaltype: 2,
        tags: [{ tag: 'role', value: 'api', operator: 0 }],
      });
    });

    it('builds tag filters with numeric operator and default evaltype when using unsupported evalType', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getHosts(
        undefined,
        false,
        [
          { tag: 'role', value: 'api', operator: HostTagOperatorValue.Contains },
          { tag: '', value: 'ignore me', operator: HostTagOperatorValue.Equals },
        ],
        '3' as ZabbixTagEvalType
      );

      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('host.get', {
        output: ['hostid', 'name', 'host'],
        sortfield: 'name',
        selectTags: 'extend',
        evaltype: 0,
        tags: [{ tag: 'role', value: 'api', operator: 0 }],
      });
    });
  });

  describe('getSLA', () => {
    it('defaults empty slaInterval to auto and builds SLA intervals', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getSLA(['1'], [0, 7200], { intervalMs: 1000 }, undefined);

      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('service.getsla', {
        serviceids: ['1'],
        intervals: [
          { from: 0, to: 3600 },
          { from: 3600, to: 7200 },
        ],
      });
    });

    it('uses provided slaInterval when not empty', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getSLA(['1'], [0, 7200], { intervalMs: 1000 }, '2h');

      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('service.getsla', {
        serviceids: ['1'],
        intervals: [{ from: 0, to: 7200 }],
      });
    });

    it('builds intervals when slaInterval is auto', () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn();

      zabbixAPIConnector.getSLA(['1'], [0, 7200], { intervalMs: 1000 }, 'auto');

      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('service.getsla', {
        serviceids: ['1'],
        intervals: [
          { from: 0, to: 3600 },
          { from: 3600, to: 7200 },
        ],
      });
    });
  });

  describe('getSLA60', () => {
    it('defaults empty slaInterval to auto and builds periods', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn((method: string) => {
        if (method === 'sla.get') {
          return Promise.resolve([{ slaid: '1' }]);
        }
        return Promise.resolve({ length: 1, serviceids: [], periods: [], sli: [] });
      });

      await zabbixAPIConnector.getSLA60(['1'], [0, 7200], { intervalMs: 1000 }, undefined as any);

      const [, params] = (zabbixAPIConnector.request as jest.Mock).mock.calls.at(-1)!;
      expect(params).toEqual({
        slaid: '1',
        serviceids: ['1'],
        period_from: 0,
        period_to: 7200,
        periods: 2,
      });
    });

    it('uses provided slaInterval when not empty', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn((method: string) => {
        if (method === 'sla.get') {
          return Promise.resolve([{ slaid: '1' }]);
        }
        return Promise.resolve({ length: 1, serviceids: [], periods: [], sli: [] });
      });

      await zabbixAPIConnector.getSLA60(['1'], [0, 7200], { intervalMs: 1000 }, '2h');

      const [, params] = (zabbixAPIConnector.request as jest.Mock).mock.calls.at(-1)!;
      expect(params).toEqual({
        slaid: '1',
        serviceids: ['1'],
        period_from: 0,
        period_to: 7200,
        periods: 1,
      });
    });

    it('builds periods when slaInterval is auto', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn((method: string) => {
        if (method === 'sla.get') {
          return Promise.resolve([{ slaid: '1' }]);
        }
        return Promise.resolve({ length: 1, serviceids: [], periods: [], sli: [] });
      });

      await zabbixAPIConnector.getSLA60(['1'], [0, 7200], { intervalMs: 1000 }, 'auto');

      const [, params] = (zabbixAPIConnector.request as jest.Mock).mock.calls.at(-1)!;
      expect(params).toEqual({
        slaid: '1',
        serviceids: ['1'],
        period_from: 0,
        period_to: 7200,
        periods: 2,
      });
    });
  });

  describe('getSLI', () => {
    it('builds periods when slaInterval is auto', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn(() => Promise.resolve({}));

      await zabbixAPIConnector.getSLI('10', ['1'], [0, 7200], { intervalMs: 1000 }, 'auto');

      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('sla.getsli', {
        slaid: '10',
        serviceids: ['1'],
        period_from: 0,
        period_to: 7200,
        periods: 2,
      });
    });

    it('uses provided slaInterval when not empty', async () => {
      const zabbixAPIConnector = new ZabbixAPIConnector(true, true, 123);
      zabbixAPIConnector.request = jest.fn(() => Promise.resolve({}));

      await zabbixAPIConnector.getSLI('10', ['1'], [0, 7200], { intervalMs: 1000 }, '2h');

      expect(zabbixAPIConnector.request).toHaveBeenCalledWith('sla.getsli', {
        slaid: '10',
        serviceids: ['1'],
        period_from: 0,
        period_to: 7200,
        periods: 1,
      });
    });
  });
});

const triggers = [
  {
    comments: 'For passive agents only, host availability is used with `3m` as a time threshold.',
    correlation_mode: '0',
    correlation_tag: '',
    description: 'Linux: Zabbix agent is not available',
    error: '',
    event_name: 'Linux: Zabbix agent is not available (for {$AGENT.TIMEOUT})',
    expression: '{30619}=0',
    flags: '0',
    hostgroups: [
      {
        flags: '0',
        groupid: '4',
        name: 'Zabbix servers',
        uuid: '6f6799aa69e844b4b3918f779f2abf08',
      },
    ],
    hosts: [
      {
        host: 'Zabbix server',
        hostid: '10084',
        name: 'Zabbix server',
      },
    ],
    lastEvent: {
      acknowledged: '0',
      clock: '1741858886',
      eventid: '23',
      name: 'Linux: Zabbix agent is not available (for 3m)',
      ns: '223852878',
      object: '0',
      objectid: '22391',
      severity: '3',
      source: '0',
      value: '1',
    },
    lastchange: '1741858886',
    manual_close: '1',
    opdata: '',
    priority: '3',
    recovery_expression: '',
    recovery_mode: '0',
    state: '0',
    status: '0',
    templateid: '22377',
    triggerid: '22391',
    type: '0',
    url: '',
    url_name: '',
    uuid: '',
    value: '1',
  },
];
