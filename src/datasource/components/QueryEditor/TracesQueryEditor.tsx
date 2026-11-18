import React, { FormEvent, useCallback } from 'react';
import { Alert, Combobox, ComboboxOption, InlineField, Input, RadioButtonGroup } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { ApmAttributeFiltersEditor, traceAttributeScopes } from './ApmAttributeFiltersEditor';
import { ZabbixDatasource } from '../../datasource';
import * as c from '../../constants';
import {
  ApmAttributeFilter,
  ApmTracesFilter,
  ApmTraceStatus,
  TracesQueryMode,
  ZabbixMetricsQuery,
} from '../../types/query';

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

const queryModeOptions = [
  {
    label: 'Search',
    value: c.TRACES_MODE_SEARCH as TracesQueryMode,
    description: 'Find traces by service, span name, status, duration, and attributes',
  },
  {
    label: 'Trace ID',
    value: c.TRACES_MODE_TRACE_ID as TracesQueryMode,
    description: 'Show all spans of one trace',
  },
];

const statusOptions: Array<ComboboxOption<ApmTraceStatus>> = [
  { value: '', label: 'Any' },
  { value: 'Error', label: 'Error' },
  { value: 'Ok', label: 'Ok' },
  { value: 'Unset', label: 'Unset' },
];

export const TracesQueryEditor = ({ query, datasource, onChange }: Props) => {
  const queryMode: TracesQueryMode = query.tracesQueryMode || c.TRACES_MODE_SEARCH;
  const apmSupported = datasource.zabbix.supportsApmTracesSync();

  const onFilterChange = (prop: keyof ApmTracesFilter) => {
    return (v: FormEvent<HTMLInputElement>) => {
      const newValue = v?.currentTarget?.value;
      if (newValue !== null && newValue !== (query.traceFilter?.[prop] ?? '')) {
        onChange({ ...query, traceFilter: { ...query.traceFilter, [prop]: newValue } });
      }
    };
  };

  const onStatusChange = (option: ComboboxOption<ApmTraceStatus>) => {
    onChange({ ...query, traceFilter: { ...query.traceFilter, status: option.value } });
  };

  const onAttributesChange = useCallback(
    (attributes: ApmAttributeFilter[]) => {
      onChange({ ...query, traceFilter: { ...query.traceFilter, attributes } });
    },
    [onChange, query]
  );

  return (
    <>
      {!apmSupported && (
        <Alert severity="warning" title="Traces require Zabbix 8.0 or higher">
          Traces are read from the Zabbix APM (OpenTelemetry) API, which is available in Zabbix 8.0 and later.
        </Alert>
      )}
      <QueryEditorRow>
        <InlineField label="Query mode" labelWidth={16}>
          <RadioButtonGroup
            options={queryModeOptions}
            value={queryMode}
            onChange={(v: TracesQueryMode) => onChange({ ...query, tracesQueryMode: v })}
          />
        </InlineField>
      </QueryEditorRow>
      {queryMode === c.TRACES_MODE_TRACE_ID && (
        <QueryEditorRow>
          <InlineField
            label="Trace ID"
            labelWidth={16}
            tooltip="The trace must have spans within the dashboard time range (extended by one hour on each side). Supports template variables."
          >
            <Input
              // Remount when the ID is set from outside, for example by a trace link
              key={query.traceFilter?.traceId}
              width={50}
              defaultValue={query.traceFilter?.traceId}
              onBlur={onFilterChange('traceId')}
              placeholder="Trace ID"
            />
          </InlineField>
        </QueryEditorRow>
      )}
      {queryMode === c.TRACES_MODE_SEARCH && (
        <>
          <QueryEditorRow>
            <InlineField
              label="Service"
              labelWidth={16}
              tooltip="Exact service name (OTEL service.name resource attribute) of any span in the trace. Supports template variables."
            >
              <Input
                width={24}
                defaultValue={query.traceFilter?.service}
                onBlur={onFilterChange('service')}
                placeholder="Service name"
              />
            </InlineField>
            <InlineField
              label="Span name"
              labelWidth={16}
              tooltip="Case-insensitive substring match on the name of any span in the trace. Supports template variables."
            >
              <Input
                width={24}
                defaultValue={query.traceFilter?.spanName}
                onBlur={onFilterChange('spanName')}
                placeholder="Span name contains"
              />
            </InlineField>
            <InlineField label="Status" labelWidth={16} tooltip="Traces with at least one span in this status.">
              <Combobox
                width={16}
                value={query.traceFilter?.status ?? ''}
                options={statusOptions}
                onChange={onStatusChange}
              />
            </InlineField>
          </QueryEditorRow>
          <QueryEditorRow>
            <InlineField
              label="Min duration"
              labelWidth={16}
              tooltip="Shortest trace duration to return, for example 100ms or 1.5s. Units: ns, us, ms, s, m, h. A number without a unit is milliseconds."
            >
              <Input
                width={24}
                defaultValue={query.traceFilter?.minDuration}
                onBlur={onFilterChange('minDuration')}
                placeholder="e.g. 100ms"
              />
            </InlineField>
            <InlineField label="Max duration" labelWidth={16} tooltip="Longest trace duration to return.">
              <Input
                width={24}
                defaultValue={query.traceFilter?.maxDuration}
                onBlur={onFilterChange('maxDuration')}
                placeholder="e.g. 5s"
              />
            </InlineField>
          </QueryEditorRow>
          <QueryEditorRow>
            <InlineField
              label="Attributes"
              labelWidth={16}
              tooltip="Filter by OTEL resource or span attributes of any span in the trace."
            >
              <ApmAttributeFiltersEditor
                value={query.traceFilter?.attributes}
                onChange={onAttributesChange}
                scopes={traceAttributeScopes}
              />
            </InlineField>
          </QueryEditorRow>
        </>
      )}
    </>
  );
};
