import { ZabbixDatasource } from './datasource';
import { ZabbixMetricsQuery, HostTagFilter, ZabbixTagEvalType } from './types/query';
import { HostTagOperatorValue } from './components/QueryEditor/types';
import * as c from './constants';

const mockTemplateSrv = {
  getVariables: jest.fn(() => [
    { name: 'tag', current: { value: 'environment' } },
    { name: 'tag_value', current: { value: 'production' } },
  ]),
  replace: jest.fn((str: string) => {
    if (str === undefined || str === null) {
      return str;
    }
    return str.replace(/\$tag\b/g, 'environment').replace(/\$tag_value\b/g, 'production');
  }),
};

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => mockTemplateSrv),
  getBackendSrv: () => ({
    datasourceRequest: jest.fn().mockResolvedValue({ data: { result: '' } }),
    fetch: () => ({
      toPromise: () => jest.fn().mockResolvedValue({ data: { result: '' } }),
    }),
  }),
  getDataSourceSrv: jest.fn(() => ({ get: jest.fn() })),
  DataSourceWithBackend: class {},
  config: { buildInfo: { env: 'production' } },
}));

describe('ZabbixDatasource', () => {
  const ctx = {
    uid: 'test-ds-uid',
    cacheTTL: '1h',
    dbConnectionEnable: false,
    jsonData: {},
    buildInfo: { env: 'production' },
  } as any;

  let datasource: ZabbixDatasource;

  beforeEach(() => {
    datasource = new ZabbixDatasource(ctx);
  });

  describe('interpolateVariablesInQueries', () => {
    it('replaces template variables in hostTags tag and value', () => {
      const hostTags: HostTagFilter[] = [{ tag: '$tag', value: '$tag_value', operator: HostTagOperatorValue.Contains }];
      const query: ZabbixMetricsQuery = {
        refId: 'A',
        schema: 1,
        queryType: c.MODE_TEXT,
        group: { filter: '' },
        host: { filter: '' },
        application: { filter: '' },
        itemTag: { filter: '' },
        item: { filter: '' },
        macro: { filter: '' },
        textFilter: '',
        mode: 0,
        itemids: '',
        useCaptureGroups: false,
        hostTags,
        evaltype: ZabbixTagEvalType.AndOr,
      };

      const result = datasource.interpolateVariablesInQueries([query], {});

      expect(result[0].hostTags).toEqual([
        { tag: '/^environment$/', value: '/^production$/', operator: HostTagOperatorValue.Contains },
      ]);
    });

    it('handles undefined hostTags', () => {
      const query: ZabbixMetricsQuery = {
        refId: 'A',
        schema: 1,
        queryType: c.MODE_TEXT,
        group: { filter: '' },
        host: { filter: '' },
        application: { filter: '' },
        itemTag: { filter: '' },
        item: { filter: '' },
        macro: { filter: '' },
        textFilter: '',
        mode: 0,
        itemids: '',
        useCaptureGroups: false,
      };

      const result = datasource.interpolateVariablesInQueries([query], {});

      expect(result[0].hostTags).toBeUndefined();
    });

    it('preserves other hostTag properties during interpolation', () => {
      const hostTags: HostTagFilter[] = [
        { tag: '$tag', value: '$tag_value', operator: HostTagOperatorValue.Equals },
        { tag: 'static', value: 'value', operator: HostTagOperatorValue.Contains },
      ];
      const query: ZabbixMetricsQuery = {
        refId: 'A',
        schema: 1,
        queryType: c.MODE_TEXT,
        group: { filter: '' },
        host: { filter: '' },
        application: { filter: '' },
        itemTag: { filter: '' },
        item: { filter: '' },
        macro: { filter: '' },
        textFilter: '',
        mode: 0,
        itemids: '',
        useCaptureGroups: false,
        hostTags,
      };

      const result = datasource.interpolateVariablesInQueries([query], {});

      expect(result[0].hostTags).toEqual([
        { tag: '/^environment$/', value: '/^production$/', operator: '1' },
        { tag: 'static', value: 'value', operator: '0' },
      ]);
    });
  });
});
