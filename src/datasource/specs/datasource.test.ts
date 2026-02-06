import { lastValueFrom, of } from 'rxjs';
import { ZabbixDatasource } from '../datasource';
import * as c from '../constants';
import * as metricFunctions from '../metricFunctions';
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

jest.mock('grafana/app/core/config', () => ({
  buildInfo: { env: 'development' },
}));

jest.mock('grafana/app/core/core', () => ({
  contextSrv: {},
}));

jest.mock('grafana/app/core/utils/datemath', () => ({
  parse: () => Date.now(),
}));

jest.mock('@grafana/runtime', () => {
  const { of } = require('rxjs');

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
  const instanceSettings: any = { id: 1, name: 'test-ds', jsonData: {} };
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

  it('applyFrontendFunctions handles hidden queries gracefully', () => {
    const ds = new ZabbixDatasource(instanceSettings);

    // Get the actual setAlias function definition
    const setAliasDef = metricFunctions.getCategories()['Alias'].find((f) => f.name === 'setAlias');

    // Create a response with a frame that has no corresponding target
    const response = {
      data: [
        { refId: 'A', fields: [] },
        { refId: 'B', fields: [] }, // This will be from a hidden query
      ],
    } as any;

    // Create a request with only target A (B is hidden)
    const request = {
      targets: [
        {
          refId: 'A',
          queryType: c.MODE_METRICS,
          functions: [{ def: setAliasDef, params: ['test'] }],
        },
      ],
    } as any;

    // This should not throw an error
    expect(() => ds.applyFrontendFunctions(response, request)).not.toThrow();

    // Response should still have both frames
    expect(response.data.length).toBe(2);
  });
});
