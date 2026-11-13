import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { ApmMetricsQueryEditor } from './ApmMetricsQueryEditor';
import * as c from '../../constants';

const metricPickerSpy = jest.fn();
const comboboxSpy = jest.fn();
const multiComboboxSpy = jest.fn();
const attributeFiltersSpy = jest.fn();

jest.mock('../../../components', () => ({
  MetricPicker: (props: any) => {
    metricPickerSpy(props);
    return null;
  },
}));

jest.mock('./ApmMetricAttributeFiltersEditor', () => ({
  ApmMetricAttributeFiltersEditor: (props: any) => {
    attributeFiltersSpy(props);
    return null;
  },
}));

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    getVariables: jest.fn(() => [{ name: 'service', type: 'query' }]),
  })),
}));

jest.mock('@grafana/ui', () => ({
  Combobox: (props: any) => {
    comboboxSpy(props);
    return <div />;
  },
  MultiCombobox: (props: any) => {
    multiComboboxSpy(props);
    return <div />;
  },
  InlineField: ({ label, children }: any) => <div data-testid={`field-${label}`}>{children}</div>,
  InlineFieldRow: ({ children }: any) => <div>{children}</div>,
  InlineFormLabel: ({ children }: any) => <div>{children}</div>,
  Input: ({ defaultValue, placeholder, onBlur }: any) => (
    <input defaultValue={defaultValue} placeholder={placeholder} onBlur={onBlur} />
  ),
}));

const catalog = {
  services: ['checkout', 'payments'],
  metrics: [
    { name: 'http.server.request.count', type: c.APM_METRIC_TYPE_SUM, unit: '{request}' },
    { name: 'http.server.request.duration', type: c.APM_METRIC_TYPE_HISTOGRAM, unit: 's' },
    { name: 'system.memory.usage', type: c.APM_METRIC_TYPE_GAUGE, unit: 'By' },
  ],
};

const buildDatasource = () => {
  const zabbix = {
    getApmMetricCatalog: jest.fn().mockResolvedValue(catalog),
    getApmMetricAttributes: jest.fn().mockResolvedValue({
      metric: { 'http.route': ['/pay'] },
      resource: { 'host.name': ['web-1'] },
    }),
  };
  return { zabbix, interpolateVariablesInQueries: jest.fn((queries: any[]) => queries) } as any;
};

const buildQuery = (apmMetric: any): any => ({
  refId: 'A',
  queryType: c.MODE_METRICS,
  metricsSource: c.METRICS_SOURCE_APM,
  apmMetric,
});

const lastProps = (spy: jest.Mock, predicate: (props: any) => boolean) =>
  [...spy.mock.calls].reverse().find(([props]) => predicate(props))?.[0];

describe('ApmMetricsQueryEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists services and metrics, with the metric type and unit, plus template variables', async () => {
    const datasource = buildDatasource();
    render(<ApmMetricsQueryEditor query={buildQuery({})} datasource={datasource} onChange={jest.fn()} />);

    await waitFor(() => {
      const metricPicker = lastProps(metricPickerSpy, (p) => p.placeholder === 'Metric name');
      expect(metricPicker.options).toEqual([
        { value: '$service', label: '$service' },
        { value: 'http.server.request.count', label: 'http.server.request.count', description: 'Sum, {request}' },
        { value: 'http.server.request.duration', label: 'http.server.request.duration', description: 'Histogram, s' },
        { value: 'system.memory.usage', label: 'system.memory.usage', description: 'Gauge, By' },
      ]);
    });

    const servicePicker = lastProps(metricPickerSpy, (p) => p.placeholder === 'Any service');
    expect(servicePicker.options.map((o: any) => o.value)).toEqual(['$service', 'checkout', 'payments']);
  });

  it('offers the label keys of the selected metric for grouping and filtering', async () => {
    const datasource = buildDatasource();
    const query = buildQuery({ service: 'checkout', metric: 'http.server.request.count' });
    render(<ApmMetricsQueryEditor query={query} datasource={datasource} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(multiComboboxSpy.mock.lastCall[0].options.map((o: any) => o.value)).toEqual(['host.name', 'http.route']);
    });
    expect(datasource.zabbix.getApmMetricAttributes).toHaveBeenCalledWith(
      expect.any(Array),
      'http.server.request.count',
      'checkout'
    );
    expect(attributeFiltersSpy.mock.lastCall[0].attributes.metric).toEqual({ 'http.route': ['/pay'] });
  });

  it('shows only the conversion that applies to the type of the selected metric', async () => {
    const datasource = buildDatasource();
    const { queryByTestId, rerender } = render(
      <ApmMetricsQueryEditor
        query={buildQuery({ metric: 'http.server.request.count' })}
        datasource={datasource}
        onChange={jest.fn()}
      />
    );

    await waitFor(() => expect(queryByTestId('field-Histogram as')).toBeNull());
    expect(queryByTestId('field-Sum as')).not.toBeNull();

    rerender(
      <ApmMetricsQueryEditor
        query={buildQuery({ metric: 'http.server.request.duration' })}
        datasource={datasource}
        onChange={jest.fn()}
      />
    );
    await waitFor(() => expect(queryByTestId('field-Sum as')).toBeNull());
    expect(queryByTestId('field-Histogram as')).not.toBeNull();
    expect(queryByTestId('field-Quantiles')).not.toBeNull();

    // A gauge needs neither
    rerender(
      <ApmMetricsQueryEditor
        query={buildQuery({ metric: 'system.memory.usage' })}
        datasource={datasource}
        onChange={jest.fn()}
      />
    );
    await waitFor(() => expect(queryByTestId('field-Histogram as')).toBeNull());
    expect(queryByTestId('field-Sum as')).toBeNull();

    // Unknown type (a variable or an unlisted metric): both are offered
    rerender(
      <ApmMetricsQueryEditor query={buildQuery({ metric: '$metric' })} datasource={datasource} onChange={jest.fn()} />
    );
    await waitFor(() => expect(queryByTestId('field-Sum as')).not.toBeNull());
    expect(queryByTestId('field-Histogram as')).not.toBeNull();
  });

  it('updates the APM part of the query', async () => {
    const datasource = buildDatasource();
    const onChange = jest.fn();
    const query = buildQuery({ metric: 'http.server.request.count' });
    render(<ApmMetricsQueryEditor query={query} datasource={datasource} onChange={onChange} />);

    await waitFor(() => expect(datasource.zabbix.getApmMetricCatalog).toHaveBeenCalled());

    lastProps(metricPickerSpy, (p) => p.placeholder === 'Any service').onChange('payments');
    expect(onChange).toHaveBeenLastCalledWith({
      ...query,
      apmMetric: { metric: 'http.server.request.count', service: 'payments' },
    });

    multiComboboxSpy.mock.lastCall[0].onChange([{ value: 'http.route' }]);
    expect(onChange).toHaveBeenLastCalledWith({
      ...query,
      apmMetric: { metric: 'http.server.request.count', groupBy: ['http.route'] },
    });
  });
});
