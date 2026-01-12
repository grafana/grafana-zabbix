import _ from 'lodash';
import React, { useEffect, FormEvent } from 'react';
import { useAsyncFn } from 'react-use';

import { InlineField, InlineSwitch, Input, ComboboxOption } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { ZabbixMetricsQuery } from '../../types/query';
import { useInterpolatedQuery } from '../../hooks/useInterpolatedQuery';

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

export const TextMetricsQueryEditor = ({ query, datasource, onChange }: Props) => {
  const interpolatedQuery = useInterpolatedQuery(datasource, query);

  const loadGroupOptions = async () => {
    const groups = await datasource.zabbix.getAllGroups();
    const options = groups?.map((group) => ({
      value: group.name,
      label: group.name,
    }));
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: groupsLoading, value: groupsOptions }, fetchGroups] = useAsyncFn(async () => {
    const options = await loadGroupOptions();
    return options;
  }, []);

  const loadHostOptions = async (group: string) => {
    const hosts = await datasource.zabbix.getAllHosts(group);
    let options: Array<ComboboxOption<string>> = hosts?.map((host) => ({
      value: host.name,
      label: host.name,
    }));
    options = _.uniqBy(options, (o) => o.value);
    options.unshift({ value: '/.*/' });
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: hostsLoading, value: hostOptions }, fetchHosts] = useAsyncFn(async () => {
    const options = await loadHostOptions(interpolatedQuery.group.filter);
    return options;
  }, [interpolatedQuery.group.filter]);

  const loadAppOptions = async (group: string, host: string) => {
    const apps = await datasource.zabbix.getAllApps(group, host);
    let options: Array<ComboboxOption<string>> = apps?.map((app) => ({
      value: app.name,
      label: app.name,
    }));
    options = _.uniqBy(options, (o) => o.value);
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: appsLoading, value: appOptions }, fetchApps] = useAsyncFn(async () => {
    const options = await loadAppOptions(interpolatedQuery.group.filter, interpolatedQuery.host.filter);
    return options;
  }, [interpolatedQuery.group.filter, interpolatedQuery.host.filter]);

  const loadItemOptions = async (group: string, host: string, app: string, itemTag: string) => {
    const options = {
      itemtype: 'text',
      showDisabledItems: query.options.showDisabledItems,
    };
    const items = await datasource.zabbix.getAllItems(group, host, app, itemTag, options);
    let itemOptions: Array<ComboboxOption<string>> = items?.map((item) => ({
      value: item.name,
      label: item.name,
    }));
    itemOptions = _.uniqBy(itemOptions, (o) => o.value);
    itemOptions.unshift(...getVariableOptions());
    return itemOptions;
  };

  const [{ loading: itemsLoading, value: itemOptions }, fetchItems] = useAsyncFn(async () => {
    const options = await loadItemOptions(
      interpolatedQuery.group.filter,
      interpolatedQuery.host.filter,
      interpolatedQuery.application.filter,
      interpolatedQuery.itemTag.filter
    );
    return options;
  }, [
    interpolatedQuery.group.filter,
    interpolatedQuery.host.filter,
    interpolatedQuery.application.filter,
    interpolatedQuery.itemTag.filter,
  ]);

  // Update suggestions on every metric change
  const groupFilter = interpolatedQuery.group?.filter;
  const hostFilter = interpolatedQuery.host?.filter;
  const appFilter = interpolatedQuery.application?.filter;
  const tagFilter = interpolatedQuery.itemTag?.filter;

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchHosts();
  }, [groupFilter]);

  useEffect(() => {
    fetchApps();
  }, [groupFilter, hostFilter]);

  useEffect(() => {
    fetchItems();
  }, [groupFilter, hostFilter, appFilter, tagFilter]);

  const onTextFilterChange = (v: FormEvent<HTMLInputElement>) => {
    const newValue = v?.currentTarget?.value;
    if (newValue !== null) {
      onChange({ ...query, textFilter: newValue });
    }
  };

  const onFilterChange = (prop: string) => {
    return (value: string) => {
      if (value !== null) {
        onChange({ ...query, [prop]: { filter: value } });
      }
    };
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
        <InlineField label="Application" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.application.filter}
            options={appOptions}
            isLoading={appsLoading}
            onChange={onFilterChange('application')}
            createCustomValue={true}
            placeholder="Application name"
          />
        </InlineField>
        <InlineField label="Item" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.item.filter}
            options={itemOptions}
            isLoading={itemsLoading}
            onChange={onFilterChange('item')}
            createCustomValue={true}
            placeholder="Item name"
          />
        </InlineField>
      </QueryEditorRow>
      <QueryEditorRow>
        <InlineField label="Text filter" labelWidth={12}>
          <Input
            width={24}
            defaultValue={query.textFilter}
            onBlur={onTextFilterChange}
            placeholder="Metric text filter"
          />
        </InlineField>
        <InlineField label="Use capture groups" labelWidth={18}>
          <InlineSwitch
            value={query.useCaptureGroups}
            onChange={() => onChange({ ...query, useCaptureGroups: !query.useCaptureGroups })}
          />
        </InlineField>
      </QueryEditorRow>
    </>
  );
};
