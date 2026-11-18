import React, { FormEvent, useEffect } from 'react';
import { TimeRange } from '@grafana/data';
import { Combobox, ComboboxOption, InlineField, Input, MultiCombobox } from '@grafana/ui';
import * as c from '../../constants';
import { ZabbixDatasource } from '../../datasource';
import { useAsyncFn } from '../../hooks/useAsyncFn';
import { useInterpolatedQuery } from '../../hooks/useInterpolatedQuery';
import {
  ApmAggregation,
  ApmHistogramMode,
  ApmMetricAttributeFilter,
  ApmMetricQuery,
  ApmSumMode,
  ZabbixMetricsQuery,
} from '../../types/query';
import { ApmMetricInfo } from '../../zabbix/types';
import { MetricPicker } from '../../../components';
import { ApmMetricAttributeFiltersEditor } from './ApmMetricAttributeFiltersEditor';
import { QueryEditorRow } from './QueryEditorRow';
import { getVariableOptions } from './utils';

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  range?: TimeRange;
  onChange: (query: ZabbixMetricsQuery) => void;
}

const LABEL_WIDTH = 16;

const APM_METRIC_TYPE_NAMES: Record<number, string> = {
  [c.APM_METRIC_TYPE_GAUGE]: 'Gauge',
  [c.APM_METRIC_TYPE_SUM]: 'Sum',
  [c.APM_METRIC_TYPE_HISTOGRAM]: 'Histogram',
  [c.APM_METRIC_TYPE_EXPONENTIAL_HISTOGRAM]: 'Exponential histogram',
};

const sumModeOptions: Array<ComboboxOption<ApmSumMode>> = [
  { value: 'auto', label: 'Auto', description: 'Rate for monotonic sums (counters), raw values otherwise' },
  { value: 'rate', label: 'Rate', description: 'Per-second rate of increase' },
  { value: 'increase', label: 'Increase', description: 'Increase between data points' },
  { value: 'raw', label: 'Raw', description: 'Values as reported' },
];

const histogramModeOptions: Array<ComboboxOption<ApmHistogramMode>> = [
  { value: 'quantiles', label: 'Quantiles', description: 'Quantiles estimated from the buckets' },
  { value: 'average', label: 'Average', description: 'Sum of measurements divided by their count' },
  { value: 'count', label: 'Count rate', description: 'Measurements per second' },
  { value: 'buckets', label: 'Buckets', description: 'One series per bucket, for the Heatmap panel' },
];

const aggregationOptions: Array<ComboboxOption<ApmAggregation>> = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

/** Dashboard time range in unix seconds, the last hour when unknown */
function getLookupTimeRange(range?: TimeRange): number[] {
  if (range?.from && range?.to) {
    return [range.from.unix(), range.to.unix()];
  }
  const now = Math.floor(Date.now() / 1000);
  return [now - 3600, now];
}

export const ApmMetricsQueryEditor = ({ query, datasource, range, onChange }: Props) => {
  const apm: ApmMetricQuery = query.apmMetric ?? {};
  const interpolated = useInterpolatedQuery(datasource, query).apmMetric ?? {};
  const rangeFrom = range?.from?.unix();
  const rangeTo = range?.to?.unix();

  const [{ loading: catalogLoading, value: catalog }, fetchCatalog] = useAsyncFn(
    () => datasource.zabbix.getApmMetricCatalog(getLookupTimeRange(range), interpolated.service),
    [interpolated.service, rangeFrom, rangeTo]
  );
  // Services are listed regardless of the selected service
  const [{ loading: servicesLoading, value: serviceCatalog }, fetchServices] = useAsyncFn(
    () => datasource.zabbix.getApmMetricCatalog(getLookupTimeRange(range)),
    [rangeFrom, rangeTo]
  );
  const [{ value: attributes }, fetchAttributes] = useAsyncFn(
    () =>
      datasource.zabbix.getApmMetricAttributes(getLookupTimeRange(range), interpolated.metric, interpolated.service),
    [interpolated.metric, interpolated.service, rangeFrom, rangeTo]
  );

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);
  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const onApmChange = (patch: Partial<ApmMetricQuery>) => {
    onChange({ ...query, apmMetric: { ...apm, ...patch } });
  };

  const onInputBlur = (prop: 'quantiles' | 'legend') => (evt: FormEvent<HTMLInputElement>) => {
    const value = evt.currentTarget.value;
    if (value !== (apm[prop] ?? '')) {
      onApmChange({ [prop]: value });
    }
  };

  const onMaxPointsBlur = (evt: FormEvent<HTMLInputElement>) => {
    const value = Number(evt.currentTarget.value);
    const maxPoints = Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
    if (maxPoints !== apm.maxPoints) {
      onApmChange({ maxPoints });
    }
  };

  const serviceOptions: Array<ComboboxOption<string>> = [
    ...getVariableOptions(),
    ...(serviceCatalog?.services ?? []).map((s) => ({ value: s, label: s })),
  ];

  const metricOptions: Array<ComboboxOption<string>> = [
    ...getVariableOptions(),
    ...(catalog?.metrics ?? []).map((m: ApmMetricInfo) => ({
      value: m.name,
      label: m.name,
      description: [APM_METRIC_TYPE_NAMES[m.type], m.unit].filter(Boolean).join(', '),
    })),
  ];

  const labelOptions: Array<ComboboxOption<string>> = Array.from(
    new Set([
      ...Object.keys(attributes?.metric ?? {}),
      ...Object.keys(attributes?.resource ?? {}),
      ...(apm.groupBy ?? []),
    ])
  )
    .sort()
    .map((label) => ({ value: label, label }));

  // The type of the selected metric decides which conversions apply. It is unknown
  // for a variable or a metric that is not in the sampled data: offer both then.
  const metricType = catalog?.metrics.find((m) => m.name === interpolated.metric)?.type;
  const isSum = metricType === undefined || metricType === c.APM_METRIC_TYPE_SUM;
  const isHistogram =
    metricType === undefined ||
    metricType === c.APM_METRIC_TYPE_HISTOGRAM ||
    metricType === c.APM_METRIC_TYPE_EXPONENTIAL_HISTOGRAM;
  const histogramMode = apm.histogramMode ?? 'quantiles';

  return (
    <>
      <QueryEditorRow>
        <InlineField
          label="Service"
          labelWidth={LABEL_WIDTH}
          tooltip="OpenTelemetry service name. Empty for any service."
        >
          <MetricPicker
            width={24}
            value={apm.service ?? ''}
            options={serviceOptions}
            isLoading={servicesLoading}
            onChange={(service) => onApmChange({ service })}
            placeholder="Any service"
            createCustomValue={true}
          />
        </InlineField>
        <InlineField
          label="Metric"
          labelWidth={LABEL_WIDTH}
          tooltip="Metric name. The list holds the metrics seen in the most recent data points of the time range; type a name to use one that is not listed."
        >
          <MetricPicker
            width={48}
            value={apm.metric ?? ''}
            options={metricOptions}
            isLoading={catalogLoading}
            onChange={(metric) => onApmChange({ metric })}
            placeholder="Metric name"
            createCustomValue={true}
          />
        </InlineField>
      </QueryEditorRow>
      <QueryEditorRow>
        <InlineField
          label="Attributes"
          labelWidth={LABEL_WIDTH}
          tooltip="Return only the series whose attributes match all of the conditions."
        >
          <ApmMetricAttributeFiltersEditor
            value={apm.attributes}
            attributes={attributes}
            onChange={(filters: ApmMetricAttributeFilter[]) => onApmChange({ attributes: filters })}
          />
        </InlineField>
      </QueryEditorRow>
      <QueryEditorRow>
        <InlineField
          label="Group by"
          labelWidth={LABEL_WIDTH}
          tooltip="Aggregate the series that share the values of these labels. Empty returns one series per unique attribute set."
        >
          <MultiCombobox<string>
            width={48}
            value={apm.groupBy ?? []}
            options={labelOptions}
            onChange={(options) => onApmChange({ groupBy: options.map((o) => o.value) })}
            createCustomValue={true}
            placeholder="No grouping"
          />
        </InlineField>
        {(apm.groupBy?.length ?? 0) > 0 && (
          <InlineField
            label="Aggregation"
            labelWidth={LABEL_WIDTH}
            tooltip="How grouped gauge and sum series are combined. Grouped histograms are always merged bucket by bucket."
          >
            <Combobox<ApmAggregation>
              width={16}
              value={apm.aggregation ?? 'sum'}
              options={aggregationOptions}
              onChange={(option) => onApmChange({ aggregation: option.value })}
            />
          </InlineField>
        )}
      </QueryEditorRow>
      <QueryEditorRow>
        {isSum && (
          <InlineField label="Sum as" labelWidth={LABEL_WIDTH} tooltip="How Sum (counter) metrics are returned.">
            <Combobox<ApmSumMode>
              width={24}
              value={apm.sumMode ?? 'auto'}
              options={sumModeOptions}
              onChange={(option) => onApmChange({ sumMode: option.value })}
            />
          </InlineField>
        )}
        {isHistogram && (
          <InlineField
            label="Histogram as"
            labelWidth={LABEL_WIDTH}
            tooltip="How Histogram and Exponential histogram metrics are returned."
          >
            <Combobox<ApmHistogramMode>
              width={24}
              value={histogramMode}
              options={histogramModeOptions}
              onChange={(option) => onApmChange({ histogramMode: option.value })}
            />
          </InlineField>
        )}
        {isHistogram && histogramMode === 'quantiles' && (
          <InlineField label="Quantiles" labelWidth={LABEL_WIDTH} tooltip="Comma-separated quantiles between 0 and 1.">
            <Input
              width={24}
              defaultValue={apm.quantiles ?? ''}
              placeholder="0.5, 0.95, 0.99"
              onBlur={onInputBlur('quantiles')}
            />
          </InlineField>
        )}
      </QueryEditorRow>
      <QueryEditorRow>
        <InlineField
          label="Legend"
          labelWidth={LABEL_WIDTH}
          tooltip="Series name template. Use {{label}} for a label value and {{__name__}} for the metric name. Empty: the metric name and the labels that differ between the series."
        >
          <Input
            width={48}
            defaultValue={apm.legend ?? ''}
            placeholder="{{service.name}} {{http.route}}"
            onBlur={onInputBlur('legend')}
          />
        </InlineField>
        <InlineField
          label="Point limit"
          labelWidth={LABEL_WIDTH}
          tooltip="Maximum number of raw data points fetched from Zabbix. Zabbix returns raw data points only, so long time ranges and many series need more points. When the limit is reached, the newest points are kept and the panel shows a warning."
        >
          <Input
            width={16}
            type="number"
            min={1}
            defaultValue={apm.maxPoints ?? ''}
            placeholder={String(c.DEFAULT_APM_METRICS_MAX_POINTS)}
            onBlur={onMaxPointsBlur}
          />
        </InlineField>
      </QueryEditorRow>
    </>
  );
};
