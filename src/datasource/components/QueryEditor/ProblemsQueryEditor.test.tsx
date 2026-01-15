import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { ProblemsQueryEditor } from './ProblemsQueryEditor';
import { ShowProblemTypes, ZabbixTagEvalType } from '../../types/query';

const metricPickerSpy = jest.fn();

jest.mock('../../../components', () => ({
  MetricPicker: (props: any) => {
    metricPickerSpy(props);
    return null;
  },
}));

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    getVariables: jest.fn(() => []),
  })),
}));

jest.mock('@grafana/ui', () => ({
  Combobox: (props: any) => <div {...props} />,
  InlineField: ({ children }: any) => <div>{children}</div>,
  InlineFieldRow: ({ children }: any) => <div>{children}</div>,
  InlineFormLabel: ({ children }: any) => <div>{children}</div>,
  Input: (props: any) => <input {...props} />,
  MultiSelect: (props: any) => <div {...props} />,
}));

const baseQuery: any = {
  group: { filter: '' },
  host: { filter: '' },
  proxy: { filter: '' },
  application: { filter: '' },
  trigger: { filter: '' },
  tags: { filter: '' },
  evaltype: ZabbixTagEvalType.AndOr,
  showProblems: ShowProblemTypes.Problems,
  options: { severities: [] },
};

const buildDatasource = (overrides: Partial<any> = {}) => {
  const zabbix = {
    getAllGroups: jest.fn().mockResolvedValue([]),
    getAllHosts: jest.fn().mockResolvedValue([]),
    getAllApps: jest.fn().mockResolvedValue([]),
    getProxies: jest.fn().mockResolvedValue([]),
    supportsApplications: jest.fn(() => true),
    ...overrides,
  };

  return {
    zabbix,
    interpolateVariablesInQueries: jest.fn((queries: any[]) => queries),
  };
};

describe('ProblemsQueryEditor', () => {
  beforeEach(() => {
    metricPickerSpy.mockClear();
  });

  it('uses proxy name when host is missing', async () => {
    const datasource = buildDatasource({
      getProxies: jest.fn().mockResolvedValue([{ name: 'proxy-a' }]),
    });

    render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={jest.fn()} />);

    await waitFor(() => {
      const proxyCall = metricPickerSpy.mock.calls
        .map((call) => call[0])
        .find((props) => props?.placeholder === 'Proxy name' && props?.options);

      expect(proxyCall).toBeTruthy();
      expect(proxyCall.options).toEqual([{ value: 'proxy-a', label: 'proxy-a' }]);
    });
  });

  it('uses proxy host when present', async () => {
    const datasource = buildDatasource({
      getProxies: jest.fn().mockResolvedValue([{ host: 'legacy-proxy' }]),
    });

    render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={jest.fn()} />);

    await waitFor(() => {
      const proxyCall = metricPickerSpy.mock.calls
        .map((call) => call[0])
        .find((props) => props?.placeholder === 'Proxy name' && props?.options);

      expect(proxyCall).toBeTruthy();
      expect(proxyCall.options).toEqual([{ value: 'legacy-proxy', label: 'legacy-proxy' }]);
    });
  });

  it('defaults missing option values to empty strings', async () => {
    const datasource = buildDatasource({
      getAllGroups: jest.fn().mockResolvedValue([{ name: 'group-a' }, { name: '' }, {}]),
      getAllHosts: jest.fn().mockResolvedValue([{ name: 'host-a' }, { name: '' }, {}]),
      getAllApps: jest.fn().mockResolvedValue([{ name: 'app-a' }, { name: '' }, {}]),
      getProxies: jest.fn().mockResolvedValue([{ name: '' }, { host: '' }, { name: 'proxy-a' }]),
    });

    render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={jest.fn()} />);

    await waitFor(() => {
      const groupCall = metricPickerSpy.mock.calls
        .map((call) => call[0])
        .find((props) => props?.placeholder === 'Group name' && props?.options);
      const hostCall = metricPickerSpy.mock.calls
        .map((call) => call[0])
        .find((props) => props?.placeholder === 'Host name' && props?.options);
      const appCall = metricPickerSpy.mock.calls
        .map((call) => call[0])
        .find((props) => props?.placeholder === 'Application name' && props?.options);
      const proxyCall = metricPickerSpy.mock.calls
        .map((call) => call[0])
        .find((props) => props?.placeholder === 'Proxy name' && props?.options);

      const hasValidValues = (options: any[]) =>
        options.every(
          (option) => option.value !== undefined && (option.label !== undefined || option.value === '/.*/')
        );

      expect(hasValidValues(groupCall.options)).toBe(true);
      expect(hasValidValues(hostCall.options)).toBe(true);
      expect(hasValidValues(appCall.options)).toBe(true);
      expect(hasValidValues(proxyCall.options)).toBe(true);
    });
  });
});
