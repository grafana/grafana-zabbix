import _ from 'lodash';
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { InlineField } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { ZabbixMetricsQuery, ZBXItem, ZBXItemTag } from '../../types';
import { itemTagToString } from '../../utils';

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

export const MetricsQueryEditor = ({ query, datasource, onChange }: Props) => {
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

  const [{ loading: tagsLoading, value: tagOptions }, fetchTags] = useAsyncFn(async () => {
    const options = await loadTagOptions(query.group.filter, query.host.filter);
    return options;
  }, [query.group.filter, query.host.filter]);

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
    fetchTags();
  }, [groupFilter, hostFilter]);

  useEffect(() => {
    fetchItems();
  }, [groupFilter, hostFilter, appFilter, tagFilter]);

  const onFilterChange = (prop: string) => {
    return (value: string) => {
      if (value !== null) {
        onChange({ ...query, [prop]: { filter: value } });
      }
    };
  };

  const supportsApplications = datasource.zabbix.supportsApplications();

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
          />
        </InlineField>
        <InlineField label="Host" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.host.filter}
            options={hostOptions}
            isLoading={hostsLoading}
            onChange={onFilterChange('host')}
          />
        </InlineField>
      </QueryEditorRow>
      <QueryEditorRow>
        {supportsApplications && (
          <InlineField label="Application" labelWidth={12}>
            <MetricPicker
              width={24}
              value={query.application.filter}
              options={appOptions}
              isLoading={appsLoading}
              onChange={onFilterChange('application')}
            />
          </InlineField>
        )}
        {!supportsApplications && (
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
        <InlineField label="Item" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.item.filter}
            options={itemOptions}
            isLoading={itemsLoading}
            onChange={onFilterChange('item')}
          />
        </InlineField>
      </QueryEditorRow>
    </>
  );
};
