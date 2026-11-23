import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { TriggersQueryEditor } from './TriggersQueryEditor';

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
  Combobox: () => <div />,
  InlineField: ({ children }: any) => <div>{children}</div>,
  InlineFieldRow: ({ children }: any) => <div>{children}</div>,
  InlineFormLabel: ({ children }: any) => <div>{children}</div>,
  InlineSwitch: () => <div />,
  Input: (props: any) => <input {...props} />,
  MultiSelect: () => <div />,
}));

const query: any = {
  countTriggersBy: 'problems',
  group: { filter: '' },
  host: { filter: '' },
  proxy: { filter: '' },
  application: { filter: '' },
  trigger: { filter: '' },
  itemTag: { filter: '' },
  tags: { filter: '' },
  options: { minSeverity: 0 },
};

const buildDatasource = (proxies: any[]) => ({
  zabbix: {
    getAllGroups: jest.fn().mockResolvedValue([]),
    getAllHosts: jest.fn().mockResolvedValue([]),
    getAllApps: jest.fn().mockResolvedValue([]),
    getAllItems: jest.fn().mockResolvedValue([]),
    getProxies: jest.fn().mockResolvedValue(proxies),
    isZabbix54OrHigher: jest.fn().mockResolvedValue(true),
    supportsApplications: jest.fn(() => false),
  },
  interpolateVariablesInQueries: jest.fn((queries: any[]) => queries),
});

const proxyOptions = () =>
  metricPickerSpy.mock.calls
    .map((call) => call[0])
    .find((props) => props?.placeholder === 'Proxy name' && props?.options)?.options;

describe('TriggersQueryEditor', () => {
  beforeEach(() => {
    metricPickerSpy.mockClear();
  });

  it('uses the proxy name returned by Zabbix 7.0 and later', async () => {
    render(
      <TriggersQueryEditor
        query={query}
        datasource={buildDatasource([{ proxyid: '1', name: 'proxy-7' }]) as any}
        onChange={jest.fn()}
      />
    );

    await waitFor(() => expect(proxyOptions()).toEqual([{ value: 'proxy-7', label: 'proxy-7' }]));
  });

  it('uses the proxy host returned by Zabbix before 7.0', async () => {
    render(
      <TriggersQueryEditor
        query={query}
        datasource={buildDatasource([{ proxyid: '1', host: 'legacy-proxy' }]) as any}
        onChange={jest.fn()}
      />
    );

    await waitFor(() => expect(proxyOptions()).toEqual([{ value: 'legacy-proxy', label: 'legacy-proxy' }]));
  });
});
