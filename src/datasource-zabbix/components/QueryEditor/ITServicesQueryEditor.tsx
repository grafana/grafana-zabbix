import _ from 'lodash';
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { InlineField, Select } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { ZabbixMetricsQuery } from '../../types';

const slaPropertyList: SelectableValue<string>[] = [
  { label: 'Status', value: 'status' },
  { label: 'SLA', value: 'sla' },
  { label: 'OK time', value: 'okTime' },
  { label: 'Problem time', value: 'problemTime' },
  { label: 'Down time', value: 'downtimeTime' },
];

const slaIntervals: SelectableValue<string>[] = [
  { label: 'No interval', value: 'none' },
  { label: 'Auto', value: 'auto' },
  { label: '1 hour', value: '1h' },
  { label: '12 hours', value: '12h' },
  { label: '24 hours', value: '1d' },
  { label: '1 week', value: '1w' },
  { label: '1 month', value: '1M' },
];

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

export const ITServicesQueryEditor = ({ query, datasource, onChange }: Props) => {
  const loadITServiceOptions = async () => {
    const services = await datasource.zabbix.getITService();
    const options = services?.map((s) => ({
      value: s.name,
      label: s.name,
    }));
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: itServicesLoading, value: itServicesOptions }, fetchITServices] = useAsyncFn(async () => {
    const options = await loadITServiceOptions();
    return options;
  }, []);

  useEffect(() => {
    fetchITServices();
  }, []);

  const onPropChange = (prop: string) => {
    return (option: SelectableValue) => {
      if (option.value) {
        onChange({ ...query, [prop]: option.value });
      }
    };
  };

  const onITServiceChange = (value: string) => {
    if (value !== null) {
      onChange({ ...query, itServiceFilter: value });
    }
  };

  return (
    <QueryEditorRow>
      <InlineField label="IT Service" labelWidth={12}>
        <MetricPicker
          width={24}
          value={query.itServiceFilter}
          options={itServicesOptions}
          isLoading={itServicesLoading}
          onChange={onITServiceChange}
        />
      </InlineField>
      <InlineField label="Property" labelWidth={12}>
        <Select
          isSearchable={false}
          width={24}
          value={query.slaProperty}
          options={slaPropertyList}
          onChange={onPropChange('slaProperty')}
        />
      </InlineField>
      <InlineField label="Interval" labelWidth={12}>
        <Select
          isSearchable={false}
          width={24}
          value={query.slaInterval}
          options={slaIntervals}
          onChange={onPropChange('slaInterval')}
        />
      </InlineField>
    </QueryEditorRow>
  );
};
