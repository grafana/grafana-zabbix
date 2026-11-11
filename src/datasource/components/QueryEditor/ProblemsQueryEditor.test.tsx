import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { ProblemsQueryEditor } from './ProblemsQueryEditor';
import { ShowProblemTypes, ZabbixTagEvalType } from '../../types/query';

const metricPickerSpy = jest.fn();
const comboboxSpy = jest.fn();
const problemTagFilterEditorSpy = jest.fn();

jest.mock('../../../components', () => ({
  MetricPicker: (props: any) => {
    metricPickerSpy(props);
    return null;
  },
}));

jest.mock('./ProblemTagFilterEditor', () => ({
  ProblemTagFilterEditor: (props: any) => {
    problemTagFilterEditorSpy(props);
    return null;
  },
}));

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    getVariables: jest.fn(() => []),
  })),
}));

jest.mock('@grafana/ui', () => ({
  Combobox: (props: any) => {
    comboboxSpy(props);
    return <div />;
  },
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
    supportsCauseSymptomProblems: jest.fn(() => true),
    supportsProblemTagOperators: jest.fn(() => true),
    version: '7.0.0',
    ...overrides,
  };

  return {
    zabbix,
    interpolateVariablesInQueries: jest.fn((queries: any[]) => queries),
  };
};

const findProblemTypeCombobox = () =>
  comboboxSpy.mock.calls
    .map((call) => call[0])
    .find((props) => props?.options?.some((option: any) => option.label === 'Symptoms only'));

describe('ProblemsQueryEditor', () => {
  beforeEach(() => {
    metricPickerSpy.mockClear();
    comboboxSpy.mockClear();
    problemTagFilterEditorSpy.mockClear();
  });

  describe('Tags filter', () => {
    it('passes structured tag filters and version support to the tag filter editor', () => {
      const datasource = buildDatasource();
      const problemTags = [{ tag: 'environment', value: 'production', operator: '0' }];
      const query = { ...baseQuery, problemTags };

      render(<ProblemsQueryEditor query={query} datasource={datasource as any} onChange={jest.fn()} />);

      expect(problemTagFilterEditorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tagFilters: problemTags,
          supportsExtendedOperators: true,
          version: '7.0.0',
          evalType: ZabbixTagEvalType.AndOr,
        })
      );
      expect(datasource.zabbix.supportsProblemTagOperators).toHaveBeenCalled();
    });

    it('defaults to no tag filters when the query has none', () => {
      const datasource = buildDatasource();

      render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={jest.fn()} />);

      expect(problemTagFilterEditorSpy).toHaveBeenCalledWith(expect.objectContaining({ tagFilters: [] }));
    });

    it('reports extended operators as unsupported for Zabbix < 5.4', () => {
      const datasource = buildDatasource({
        supportsProblemTagOperators: jest.fn(() => false),
      });

      render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={jest.fn()} />);

      expect(problemTagFilterEditorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ supportsExtendedOperators: false })
      );
    });

    it('writes tag filter changes to query.problemTags', () => {
      const datasource = buildDatasource();
      const onChange = jest.fn();

      render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={onChange} />);

      const newTags = [{ tag: 'service', value: 'web', operator: '1' }];
      problemTagFilterEditorSpy.mock.calls[0][0].onChange(newTags);

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ problemTags: newTags }));
    });

    it('builds tag name suggestions from the problems the panel already fetched', () => {
      const datasource = buildDatasource();
      const data: any = {
        series: [
          {
            fields: [
              {
                config: { custom: { type: 'problems' } },
                values: [
                  { tags: [{ tag: 'service', value: 'web' }] },
                  {
                    tags: [
                      { tag: 'environment', value: 'production' },
                      { tag: 'service', value: 'db' },
                    ],
                  },
                  {},
                ],
              },
            ],
          },
          // Non-problems frames (e.g. other queries in the panel) must be ignored
          { fields: [{ config: {}, values: [1, 2, 3] }] },
        ],
      };

      render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={jest.fn()} data={data} />);

      expect(problemTagFilterEditorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tagOptions: [
            { value: 'environment', label: 'environment' },
            { value: 'service', label: 'service' },
          ],
        })
      );
    });

    it('offers no tag suggestions when the panel has no data yet', () => {
      const datasource = buildDatasource();

      render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={jest.fn()} />);

      expect(problemTagFilterEditorSpy).toHaveBeenCalledWith(expect.objectContaining({ tagOptions: [] }));
    });

    it('writes eval type changes to query.evaltype', () => {
      const datasource = buildDatasource();
      const onChange = jest.fn();

      render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={onChange} />);

      problemTagFilterEditorSpy.mock.calls[0][0].onEvalTypeChange(ZabbixTagEvalType.Or);

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ evaltype: ZabbixTagEvalType.Or }));
    });
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

  describe('Problem Type (cause/symptom) field', () => {
    it('is shown when Zabbix supports cause/symptom problems (6.4+)', () => {
      const datasource = buildDatasource();

      render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={jest.fn()} />);

      expect(findProblemTypeCombobox()).toBeTruthy();
    });

    it('is hidden when Zabbix does not support cause/symptom problems', () => {
      const datasource = buildDatasource({
        supportsCauseSymptomProblems: jest.fn(() => false),
      });

      render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={jest.fn()} />);

      expect(findProblemTypeCombobox()).toBeUndefined();
    });

    it.each([
      [undefined, 'all'],
      [null, 'all'],
      [true, 'true'],
      [false, 'false'],
    ])('maps symptom option %s to combobox value %s', (symptom, expected) => {
      const datasource = buildDatasource();
      const query = { ...baseQuery, options: { ...baseQuery.options, symptom } };

      render(<ProblemsQueryEditor query={query} datasource={datasource as any} onChange={jest.fn()} />);

      expect(findProblemTypeCombobox().value).toBe(expected);
    });

    it.each([
      ['all', null],
      ['true', true],
      ['false', false],
    ])('selecting %s sets query symptom option to %s', (selected, expected) => {
      const datasource = buildDatasource();
      const onChange = jest.fn();

      render(<ProblemsQueryEditor query={baseQuery} datasource={datasource as any} onChange={onChange} />);

      findProblemTypeCombobox().onChange({ value: selected });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ symptom: expected }),
        })
      );
    });
  });
});
