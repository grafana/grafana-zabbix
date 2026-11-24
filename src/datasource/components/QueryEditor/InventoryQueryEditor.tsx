import _ from 'lodash';
import React, { useEffect } from 'react';
import { useAsyncFn } from '../../hooks/useAsyncFn';

import { InlineField, ComboboxOption, MultiSelect } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { ZabbixMetricsQuery } from '../../types/query';
import { useInterpolatedQuery } from '../../hooks/useInterpolatedQuery';
import { DEFAULT_INVENTORY_FIELDS, INVENTORY_FIELDS } from '../../constants';

const inventoryFieldOptions: Array<SelectableValue<string>> = INVENTORY_FIELDS.map((f) => ({ value: f, label: f }));

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

export const InventoryQueryEditor = ({ query, datasource, onChange }: Props) => {
  const interpolatedQuery = useInterpolatedQuery(datasource, query);

  const [{ loading: groupsLoading, value: groupsOptions }, fetchGroups] = useAsyncFn(async () => {
    const groups = await datasource.zabbix.getAllGroups();
    const options = groups?.map((group) => ({ value: group.name, label: group.name }));
    options.unshift(...getVariableOptions());
    return options;
  }, []);

  const [{ loading: hostsLoading, value: hostOptions }, fetchHosts] = useAsyncFn(async () => {
    const hosts = await datasource.zabbix.getAllHosts(interpolatedQuery.group.filter);
    let options: Array<ComboboxOption<string>> = hosts?.map((host) => ({ value: host.name, label: host.name }));
    options = _.uniqBy(options, (o) => o.value);
    options.unshift({ value: '/.*/' });
    options.unshift(...getVariableOptions());
    return options;
  }, [interpolatedQuery.group.filter]);

  const groupFilter = interpolatedQuery.group?.filter;

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchHosts();
  }, [groupFilter]);

  const onFilterChange = (prop: string) => {
    return (value: string) => {
      if (value !== null) {
        onChange({ ...query, [prop]: { filter: value } });
      }
    };
  };

  const onFieldsChange = (options: Array<SelectableValue<string>>) => {
    onChange({ ...query, inventoryFields: options.map((o) => o.value!) });
  };

  return (
    <>
      <QueryEditorRow>
        <InlineField label="Group" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.group.filter}
            options={groupsOptions}
            isLoading={groupsLoading}
            onChange={onFilterChange('group')}
            createCustomValue={true}
            placeholder="Group name"
          />
        </InlineField>
        <InlineField label="Host" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.host.filter}
            options={hostOptions}
            isLoading={hostsLoading}
            onChange={onFilterChange('host')}
            createCustomValue={true}
            placeholder="Host name"
          />
        </InlineField>
      </QueryEditorRow>
      <QueryEditorRow>
        <InlineField
          label="Fields"
          labelWidth={12}
          tooltip="Host inventory fields. location_lat/location_lon are returned as numeric latitude/longitude for the Geomap panel."
        >
          <MultiSelect
            width={64}
            isClearable={true}
            placeholder={DEFAULT_INVENTORY_FIELDS.join(', ')}
            value={query.inventoryFields}
            options={inventoryFieldOptions}
            onChange={onFieldsChange}
          />
        </InlineField>
      </QueryEditorRow>
    </>
  );
};
