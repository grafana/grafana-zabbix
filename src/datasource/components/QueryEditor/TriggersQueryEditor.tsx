import _ from 'lodash';
import React, { useEffect, FormEvent } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineSwitch, Input, Select } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions } from './utils';
import { itemTagToString } from '../../utils';
import { ZabbixDatasource } from '../../datasource';
import { ZabbixMetricsQuery, ZBXItem, ZBXItemTag } from '../../types';

const countByOptions: Array<SelectableValue<string>> = [
  { value: '', label: 'All triggers' },
  // { value: 'problems', label: 'Problems' },
  // { value: 'items', label: 'Items' },
];

const severityOptions: Array<SelectableValue<number>> = [
  { value: 0, label: 'Not classified' },
  { value: 1, label: 'Information' },
  { value: 2, label: 'Warning' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'High' },
  { value: 5, label: 'Disaster' },
];

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

export const TriggersQueryEditor = ({ query, datasource, onChange }: Props) => {
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
    const groupFilter = datasource.replaceTemplateVars(group);
    const hosts = await datasource.zabbix.getAllHosts(groupFilter);
    let options: Array<SelectableValue<string>> = hosts?.map((host) => ({
      value: host.name,
      label: host.name,
    }));
    options = _.uniqBy(options, (o) => o.value);
    options.unshift({ value: '/.*/' });
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: hostsLoading, value: hostOptions }, fetchHosts] = useAsyncFn(async () => {
    const options = await loadHostOptions(query.group.filter);
    return options;
  }, [query.group.filter]);

  const loadAppOptions = async (group: string, host: string) => {
    const groupFilter = datasource.replaceTemplateVars(group);
    const hostFilter = datasource.replaceTemplateVars(host);
    const apps = await datasource.zabbix.getAllApps(groupFilter, hostFilter);
    let options: Array<SelectableValue<string>> = apps?.map((app) => ({
      value: app.name,
      label: app.name,
    }));
    options = _.uniqBy(options, (o) => o.value);
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: appsLoading, value: appOptions }, fetchApps] = useAsyncFn(async () => {
    const options = await loadAppOptions(query.group.filter, query.host.filter);
    return options;
  }, [query.group.filter, query.host.filter]);

  const loadTagOptions = async (group: string, host: string) => {
    if (!datasource.zabbix.isZabbix54OrHigher()) {
      return [];
    }

    const groupFilter = datasource.replaceTemplateVars(group);
    const hostFilter = datasource.replaceTemplateVars(host);
    const items = await datasource.zabbix.getAllItems(groupFilter, hostFilter, null, null, {});
    const tags: ZBXItemTag[] = _.flatten(items.map((item: ZBXItem) => item.tags || []));

    const tagList = _.uniqBy(tags, (t) => t.tag + t.value || '').map((t) => itemTagToString(t));
    let options: Array<SelectableValue<string>> = tagList?.map((tag) => ({
      value: tag,
      label: tag,
    }));
    options = _.uniqBy(options, (o) => o.value);
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: tagsLoading, value: tagOptions }, fetchItemTags] = useAsyncFn(async () => {
    const options = await loadTagOptions(query.group.filter, query.host.filter);
    return options;
  }, [query.group.filter, query.host.filter]);

  const loadProxyOptions = async () => {
    const proxies = await datasource.zabbix.getProxies();
    const options = proxies?.map((proxy) => ({
      value: proxy.host,
      label: proxy.host,
    }));
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: proxiesLoading, value: proxiesOptions }, fetchProxies] = useAsyncFn(async () => {
    const options = await loadProxyOptions();
    return options;
  }, []);

  const loadItemOptions = async (group: string, host: string, app: string, itemTag: string) => {
    const groupFilter = datasource.replaceTemplateVars(group);
    const hostFilter = datasource.replaceTemplateVars(host);
    const appFilter = datasource.replaceTemplateVars(app);
    const tagFilter = datasource.replaceTemplateVars(itemTag);
    const options = {
      itemtype: 'num',
      showDisabledItems: query.options.showDisabledItems,
    };
    const items = await datasource.zabbix.getAllItems(groupFilter, hostFilter, appFilter, tagFilter, options);
    let itemOptions: Array<SelectableValue<string>> = items?.map((item) => ({
      value: item.name,
      label: item.name,
    }));
    itemOptions = _.uniqBy(itemOptions, (o) => o.value);
    itemOptions.unshift(...getVariableOptions());
    return itemOptions;
  };

  const [{ loading: itemsLoading, value: itemOptions }, fetchItems] = useAsyncFn(async () => {
    const options = await loadItemOptions(
      query.group.filter,
      query.host.filter,
      query.application.filter,
      query.itemTag.filter
    );
    return options;
  }, [query.group.filter, query.host.filter, query.application.filter, query.itemTag.filter]);

  // Update suggestions on every metric change
  const groupFilter = datasource.replaceTemplateVars(query.group?.filter);
  const hostFilter = datasource.replaceTemplateVars(query.host?.filter);
  const appFilter = datasource.replaceTemplateVars(query.application?.filter);
  const tagFilter = datasource.replaceTemplateVars(query.itemTag?.filter);

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
    fetchItemTags();
  }, [groupFilter, hostFilter]);

  useEffect(() => {
    fetchProxies();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [groupFilter, hostFilter, appFilter, tagFilter]);

  const onTextFilterChange = (prop: string) => {
    return (v: FormEvent<HTMLInputElement>) => {
      const newValue = v?.currentTarget?.value;
      if (newValue !== null) {
        onChange({ ...query, [prop]: { filter: newValue } });
      }
    };
  };

  const onFilterChange = (prop: string) => {
    return (value: string) => {
      if (value !== null) {
        onChange({ ...query, [prop]: { filter: value } });
      }
    };
  };

  const onMinSeverityChange = (option: SelectableValue) => {
    if (option.value !== null) {
      onChange({ ...query, options: { ...query.options, minSeverity: option.value } });
    }
  };

  const onCountByChange = (option: SelectableValue) => {
    if (option.value !== null) {
      onChange({ ...query, countTriggersBy: option.value! });
    }
  };

  const supportsApplications = datasource.zabbix.supportsApplications();

  return (
    <>
      <QueryEditorRow>
        <InlineField label="Count by" labelWidth={12}>
          <Select
            isSearchable={false}
            width={24}
            value={query.countTriggersBy}
            options={countByOptions}
            onChange={onCountByChange}
          />
        </InlineField>
      </QueryEditorRow>
      <QueryEditorRow>
        <InlineField label="Group" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.group?.filter}
            options={groupsOptions}
            isLoading={groupsLoading}
            onChange={onFilterChange('group')}
          />
        </InlineField>
        <InlineField label="Host" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.host?.filter}
            options={hostOptions}
            isLoading={hostsLoading}
            onChange={onFilterChange('host')}
          />
        </InlineField>
        {query.countTriggersBy === 'problems' && (
          <InlineField label="Proxy" labelWidth={12}>
            <MetricPicker
              width={24}
              value={query.proxy?.filter}
              options={proxiesOptions}
              isLoading={proxiesLoading}
              onChange={onFilterChange('proxy')}
            />
          </InlineField>
        )}
      </QueryEditorRow>
      <QueryEditorRow>
        {(supportsApplications || query.countTriggersBy !== 'items') && (
          <InlineField label="Application" labelWidth={12}>
            <MetricPicker
              width={24}
              value={query.application?.filter}
              options={appOptions}
              isLoading={appsLoading}
              onChange={onFilterChange('application')}
            />
          </InlineField>
        )}
        {!supportsApplications && query.countTriggersBy === 'items' && (
          <InlineField label="Item tag" labelWidth={12}>
            <MetricPicker
              width={24}
              value={query.itemTag.filter}
              options={tagOptions}
              isLoading={tagsLoading}
              onChange={onFilterChange('itemTag')}
            />
          </InlineField>
        )}
        {query.countTriggersBy === 'problems' && (
          <>
            <InlineField label="Problem" labelWidth={12}>
              <Input
                width={24}
                defaultValue={query.trigger?.filter}
                placeholder="Problem name"
                onBlur={onTextFilterChange('trigger')}
              />
            </InlineField>
            <InlineField label="Tags" labelWidth={12}>
              <Input
                width={24}
                defaultValue={query.tags?.filter}
                placeholder="tag1:value1, tag2:value2"
                onBlur={onTextFilterChange('tags')}
              />
            </InlineField>
          </>
        )}
        {query.countTriggersBy === 'items' && (
          <InlineField label="Item" labelWidth={12}>
            <MetricPicker
              width={24}
              value={query.item.filter}
              options={itemOptions}
              isLoading={itemsLoading}
              onChange={onFilterChange('item')}
            />
          </InlineField>
        )}
      </QueryEditorRow>
      <QueryEditorRow>
        <InlineField label="Min severity" labelWidth={12}>
          <Select
            isSearchable={false}
            width={24}
            value={query.options?.minSeverity}
            options={severityOptions}
            onChange={onMinSeverityChange}
          />
        </InlineField>
        <InlineField label="Count" labelWidth={12}>
          <InlineSwitch
            value={query.options?.count}
            onChange={() => onChange({ ...query, options: { ...query.options, count: !query.options?.count } })}
          />
        </InlineField>
      </QueryEditorRow>
    </>
  );
};
