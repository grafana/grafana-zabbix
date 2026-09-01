import { lastValueFrom, of } from 'rxjs';
import { dateTime } from '@grafana/data';
import { ZabbixDatasource } from '../datasource';
import * as c from '../constants';
import { DataSourceWithBackend } from '@grafana/runtime';

const buildRequest = () =>
  ({
    targets: [{ refId: 'A', queryType: c.MODE_METRICS }],
    range: { from: dateTime('2026-01-01T00:00:00Z'), to: dateTime('2026-01-01T01:00:00Z') },
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

  it('interpolates queries with range scoped vars ($__range_series, etc.)', async () => {
    const interpolateSpy = jest
      .spyOn(ZabbixDatasource.prototype, 'interpolateVariablesInQueries')
      .mockReturnValue(buildRequest().targets);
    jest.spyOn(ds, 'applyFrontendFunctions').mockImplementation((response) => response);
    jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));
    jest.spyOn(ds, 'dbConnectionQuery').mockResolvedValue({ data: [] });
    jest.spyOn(ds, 'frontendQuery').mockResolvedValue({ data: [] });
    jest.spyOn(ds, 'annotationRequest').mockResolvedValue({ data: [] });

    await lastValueFrom(ds.query(buildRequest()));

    const scopedVars = interpolateSpy.mock.calls[0][1];
    expect(scopedVars.__range_series).toEqual({ text: c.RANGE_VARIABLE_VALUE, value: c.RANGE_VARIABLE_VALUE });
    expect(scopedVars.__range).toEqual({ text: '1h', value: '1h' });
    expect(scopedVars.__range_s).toEqual({ text: 3600, value: 3600 });
    expect(scopedVars.__range_ms).toEqual({ text: 3600000, value: 3600000 });
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
