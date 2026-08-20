import { lastValueFrom, of } from 'rxjs';
import { ZabbixDatasource } from '../datasource';
import * as c from '../constants';
import { DataSourceWithBackend } from '@grafana/runtime';

const buildRequest = () =>
  ({
    targets: [{ refId: 'A', queryType: c.MODE_METRICS }],
    range: { from: 'now-1h', to: 'now' },
    scopedVars: {},
  }) as any;

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

jest.mock('../tracking', () => ({
  trackRequest: jest.fn(),
}));

jest.mock('../responseHandler', () => ({
  __esModule: true,
  default: {
    convertZabbixUnits: (resp: any) => resp,
    convertToWide: (data: any) => data,
    isConvertibleToWide: () => false,
  },
}));

jest.mock('../zabbix/zabbix', () => ({
  Zabbix: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@grafana/runtime', () => {
  class MockDataSourceWithBackend {
    instanceSettings: any;
    constructor(settings: any) {
      this.instanceSettings = settings;
    }

    query() {
      return of({ data: [] });
    }
  }

  return {
    DataSourceWithBackend: MockDataSourceWithBackend,
    config: {
      buildInfo: { env: 'development' },
      bootData: { user: { isGrafanaAdmin: false, orgRole: 'Editor' } },
    },
    getTemplateSrv: jest.fn(() => ({
      replace: (value: any) => value,
      variableExists: () => false,
    })),
    getDataSourceSrv: jest.fn(() => ({
      getInstanceSettings: () => undefined,
    })),
    getBackendSrv: jest.fn(),
    HealthCheckError: class {},
    TemplateSrv: class {},
  };
});

describe('ZabbixDatasource', () => {
  const instanceSettings: any = { id: 1, name: 'test-ds', uid: 'test-ds-uid', jsonData: {} };
  const ds = new ZabbixDatasource(instanceSettings);
  it('waits for all non-backend responses before emitting merged data', async () => {
    jest.spyOn(ZabbixDatasource.prototype, 'interpolateVariablesInQueries').mockReturnValue(buildRequest().targets);
    jest.spyOn(ds, 'applyFrontendFunctions').mockImplementation((response) => response);

    jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [{ refId: 'A' }] as any[] }));

    const dbDeferred = createDeferred<any>();
    const frontendDeferred = createDeferred<any>();
    const annotationDeferred = createDeferred<any>();

    jest.spyOn(ds, 'dbConnectionQuery').mockReturnValue(dbDeferred.promise);
    jest.spyOn(ds, 'frontendQuery').mockReturnValue(frontendDeferred.promise);
    jest.spyOn(ds, 'annotationRequest').mockReturnValue(annotationDeferred.promise);

    const request = buildRequest();
    let settled = false;
    const resultPromise = lastValueFrom(ds.query(request)).then((res) => {
      settled = true;
      return res;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    dbDeferred.resolve({ data: [{ refId: 'B' }] });
    frontendDeferred.resolve({ data: [{ refId: 'C' }] });
    annotationDeferred.resolve({ data: [{ refId: 'D' }] });

    const result = await resultPromise;
    expect(result.data).toEqual([{ refId: 'A' }, { refId: 'B' }, { refId: 'C' }, { refId: 'D' }]);
  });

  describe('queryProblems host IP option', () => {
    const buildProblemsTarget = (options: any = {}) =>
      ({
        showProblems: 'problems',
        options,
        tags: { filter: '' },
        trigger: { filter: '' },
        group: { filter: '' },
        host: { filter: '' },
        application: { filter: '' },
        proxy: { filter: '' },
        datasource: 'test-ds',
      }) as any;

    const buildZabbixMock = (problems: any[]) => ({
      getProblems: jest.fn().mockResolvedValue(problems),
      getUsers: jest.fn().mockResolvedValue([]),
      getProxies: jest.fn().mockResolvedValue([]),
      getHostInterfaces: jest.fn().mockResolvedValue([
        {
          hostid: '10001',
          interfaces: [
            { ip: '192.168.1.10', useip: '1' },
            { ip: '10.0.0.5', useip: '1' },
          ],
        },
      ]),
    });

    const problemWithHost = () => ({
      name: 'Test problem',
      suppressed: '0',
      hosts: [{ hostid: '10001', name: 'Test host', host: 'test-host' }],
    });

    it('fetches host interfaces and sets host IP when the hostIp option is enabled', async () => {
      const ds = new ZabbixDatasource(instanceSettings);
      const zabbixMock = buildZabbixMock([problemWithHost()]);
      ds.zabbix = zabbixMock as any;

      const frame = await ds.queryProblems(buildProblemsTarget({ hostIp: true }), [0, 100], {});

      expect(zabbixMock.getHostInterfaces).toHaveBeenCalledWith(['10001']);
      expect(frame.fields[0].values[0].hosts[0].hostIp).toBe('192.168.1.10, 10.0.0.5');
    });

    it('does not fetch host interfaces when the hostIp option is disabled', async () => {
      const ds = new ZabbixDatasource(instanceSettings);
      const zabbixMock = buildZabbixMock([problemWithHost()]);
      ds.zabbix = zabbixMock as any;

      await ds.queryProblems(buildProblemsTarget(), [0, 100], {});

      expect(zabbixMock.getHostInterfaces).not.toHaveBeenCalled();
    });

    it('does not fetch host interfaces when no problem has hosts', async () => {
      const ds = new ZabbixDatasource(instanceSettings);
      const zabbixMock = buildZabbixMock([{ name: 'Hostless problem', suppressed: '0', hosts: [] }]);
      ds.zabbix = zabbixMock as any;

      await ds.queryProblems(buildProblemsTarget({ hostIp: true }), [0, 100], {});

      expect(zabbixMock.getHostInterfaces).not.toHaveBeenCalled();
    });
  });

  it('mergeQueries combines data without mutating the original response', () => {
    const baseResponse = { data: [{ refId: 'A' }] } as any;
    const merged = ds.mergeQueries(
      baseResponse,
      { data: [{ refId: 'B' }] } as any,
      { data: [{ refId: 'C' }] } as any,
      { data: [{ refId: 'D' }] } as any
    );

    expect(merged.data).toEqual([{ refId: 'A' }, { refId: 'B' }, { refId: 'C' }, { refId: 'D' }]);
    expect(baseResponse.data).toEqual([{ refId: 'A' }]);
  });

  it('convertToWide delegates when data is convertible', () => {
    const ds = new ZabbixDatasource(instanceSettings);
    const response = { data: ['narrow'] } as any;
    const result = ds.convertToWide(response);
    expect(result.data).toEqual(['narrow']);
  });

  it('detects backend vs DB connection targets based on flag', () => {
    const ds = new ZabbixDatasource(instanceSettings);
    const metricsTarget = { queryType: c.MODE_METRICS } as any;
    const itemIdTarget = { queryType: c.MODE_ITEMID } as any;
    const problemsTarget = { queryType: c.MODE_PROBLEMS } as any;

    expect(ds.isBackendTarget(metricsTarget)).toBe(true);
    expect(ds.isBackendTarget(itemIdTarget)).toBe(true);
    expect(ds.isBackendTarget(problemsTarget)).toBe(false);
    expect(ds.isDBConnectionTarget(metricsTarget)).toBe(false);

    ds.enableDirectDBConnection = true;
    expect(ds.isBackendTarget(metricsTarget)).toBe(false);
    expect(ds.isDBConnectionTarget(metricsTarget)).toBe(true);
  });
});
