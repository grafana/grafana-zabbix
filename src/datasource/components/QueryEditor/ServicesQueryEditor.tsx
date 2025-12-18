import _ from 'lodash';
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { Combobox, ComboboxOption, InlineField } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { ZabbixMetricsQuery } from '../../types/query';

const slaPropertyList: Array<ComboboxOption<string>> = [
  { label: 'Status', value: 'status' },
  { label: 'SLI', value: 'sli' },
  { label: 'Uptime', value: 'uptime' },
  { label: 'Downtime', value: 'downtime' },
  { label: 'Error budget', value: 'error_budget' },
];

const slaIntervals: Array<ComboboxOption<string>> = [
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

export const ServicesQueryEditor = ({ query, datasource, onChange }: Props) => {
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

  const loadSLAOptions = async () => {
    const slaOptions = await datasource.zabbix.getSLAList();
    const options = slaOptions?.map((s) => ({
      value: s.name,
      label: s.name,
    }));
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: slaLoading, value: slaOptions }, fetchSLAOptions] = useAsyncFn(async () => {
    const options = await loadSLAOptions();
    return options;
  }, []);

  useEffect(() => {
    fetchITServices();
    fetchSLAOptions();
  }, []);

  const onPropChange = (prop: string) => {
    return (option: ComboboxOption) => {
      if (option.value) {
        onChange({ ...query, [prop]: option.value });
      }
    };
  };

  const onStringPropChange = (prop: string) => {
    return (value: string) => {
      if (value !== undefined) {
        onChange({ ...query, [prop]: value });
      }
    };
  };

  return (
    <>
      <QueryEditorRow>
        <InlineField label="Service" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.itServiceFilter}
            options={itServicesOptions}
            isLoading={itServicesLoading}
            onChange={onStringPropChange('itServiceFilter')}
            placeholder="Service name"
          />
        </InlineField>
        <InlineField label="SLA" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.slaFilter}
            options={slaOptions}
            isLoading={slaLoading}
            onChange={onStringPropChange('slaFilter')}
            placeholder="SLA name"
          />
        </InlineField>
      </QueryEditorRow>
      <QueryEditorRow>
        <InlineField label="Property" labelWidth={12}>
          <Combobox
            width={24}
            value={query.slaProperty}
            options={slaPropertyList}
            onChange={onPropChange('slaProperty')}
            placeholder="Property name"
          />
        </InlineField>
        <InlineField label="Interval" labelWidth={12}>
          <Combobox
            width={24}
            value={query.slaInterval}
            options={slaIntervals}
            onChange={onPropChange('slaInterval')}
            placeholder="SLA interval"
          />
        </InlineField>
      </QueryEditorRow>
    </>
  );
};
