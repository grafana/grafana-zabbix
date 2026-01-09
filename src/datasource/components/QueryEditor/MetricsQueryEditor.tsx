import { flatten, uniqBy } from 'lodash';
import React, { useCallback, useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { InlineField, ComboboxOption } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions, processHostTags } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { HostTagFilter, ZabbixMetricsQuery, ZabbixTagEvalType } from '../../types/query';
import { ZBXItem, ZBXItemTag } from '../../types';
import { itemTagToString } from '../../utils';
import { HostTagQueryEditor } from './HostTagQueryEditor';
import { useInterpolatedQuery } from '../../hooks/useInterpolatedQuery';

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
  onItemCountChange?: (count: number) => void;
}

export const MetricsQueryEditor = ({ query, datasource, onChange, onItemCountChange }: Props) => {
  const interpolatedQuery = useInterpolatedQuery(datasource, query);

  const loadGroupOptions = async () => {
    const groups = await datasource.zabbix.getAllGroups();
    const options = groups?.map((group) => ({
      value: group.name,
      label: group.name,
    }));
    if (options.length > 0) {
      options.unshift({ value: '/.*/' });
    }
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: groupsLoading, value: groupsOptions }, fetchGroups] = useAsyncFn(async () => {
    const options = await loadGroupOptions();
    return options;
  }, []);

  const loadHostTagOptions = async (group: string) => {
    const hostsWithTags = await datasource.zabbix.getAllHosts(group, true);
    const hostTags = processHostTags(hostsWithTags ?? []);
    let options: Array<ComboboxOption<string>> = hostTags?.map((tag) => ({
      value: tag.tag,
      label: tag.tag,
    }));
    return options;
  };

  const loadHostOptions = async (group: string, hostTags?: HostTagFilter[], evalType?: ZabbixTagEvalType) => {
    const hosts = await datasource.zabbix.getAllHosts(group, false, hostTags, evalType);
    let options: Array<ComboboxOption<string>> = hosts?.map((host) => ({
      value: host.name,
      label: host.name,
    }));
    options = uniqBy(options, (o) => o.value);
    if (options.length > 0) {
      options.unshift({ value: '/.*/' });
    }
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: hostTagsLoading, value: hostTagsOptions }, fetchHostTags] = useAsyncFn(async () => {
    const options = await loadHostTagOptions(query.group.filter);
    return options;
  }, [query.group.filter]);

  const [{ loading: hostsLoading, value: hostOptions }, fetchHosts] = useAsyncFn(async () => {
    const options = await loadHostOptions(
      interpolatedQuery.group.filter,
      interpolatedQuery.hostTags,
      interpolatedQuery.evaltype
    );

    return options;
  }, [interpolatedQuery.group.filter, interpolatedQuery.hostTags, interpolatedQuery.evaltype]);

  const loadAppOptions = async (group: string, host: string) => {
    const apps = await datasource.zabbix.getAllApps(group, host);
    let options: Array<ComboboxOption<string>> = apps?.map((app) => ({
      value: app.name,
      label: app.name,
    }));
    options = uniqBy(options, (o) => o.value);
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: appsLoading, value: appOptions }, fetchApps] = useAsyncFn(async () => {
    const options = await loadAppOptions(interpolatedQuery.group.filter, interpolatedQuery.host.filter);
    return options;
  }, [interpolatedQuery.group.filter, interpolatedQuery.host.filter]);

  const loadTagOptions = async (group: string, host: string) => {
    const tagsAvailable = await datasource.zabbix.isZabbix54OrHigher();
    if (!tagsAvailable) {
      return [];
    }

    const items = await datasource.zabbix.getAllItems(group, host, null, null, {});
    const tags: ZBXItemTag[] = flatten(items.map((item: ZBXItem) => item.tags || []));
    // const tags: ZBXItemTag[] = await datasource.zabbix.getItemTags(groupFilter, hostFilter, null);

    const tagList = uniqBy(tags, (t) => t.tag + t.value || '').map((t) => itemTagToString(t));
    let options: Array<ComboboxOption<string>> = tagList?.map((tag) => ({
      value: tag,
      label: tag,
    }));
    options = uniqBy(options, (o) => o.value);
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: tagsLoading, value: tagOptions }, fetchTags] = useAsyncFn(async () => {
    const options = await loadTagOptions(interpolatedQuery.group.filter, interpolatedQuery.host.filter);
    return options;
  }, [interpolatedQuery.group.filter, interpolatedQuery.host.filter]);

  const loadItemOptions = async (group: string, host: string, app: string, itemTag: string, itemFilter: string) => {
    const options = {
      itemtype: 'num',
      showDisabledItems: query.options.showDisabledItems,
    };
    const items = await datasource.zabbix.getAllItems(group, host, app, itemTag, options);

    // Count items that match the current item filter for the warning
    let matchingItemCount = items?.length || 0;
    if (itemFilter && items?.length) {
      // If there's an item filter, count how many items match it
      const filterRegex =
        itemFilter.startsWith('/') && itemFilter.endsWith('/') ? new RegExp(itemFilter.slice(1, -1)) : null;
      if (filterRegex) {
        matchingItemCount = items.filter((item) => filterRegex.test(item.name)).length;
      } else if (itemFilter) {
        // Exact match or partial match
        matchingItemCount = items.filter((item) => item.name === itemFilter || item.name.includes(itemFilter)).length;
      }
    }

    // Report the matching item count
    onItemCountChange?.(matchingItemCount);

    let itemOptions: Array<ComboboxOption<string>> = items?.map((item) => ({
      value: item.name,
      label: item.name,
    }));
    itemOptions = uniqBy(itemOptions, (o) => o.value);
    itemOptions.unshift(...getVariableOptions());
    return itemOptions;
  };

  const [{ loading: itemsLoading, value: itemOptions }, fetchItems] = useAsyncFn(async () => {
    const options = await loadItemOptions(
      interpolatedQuery.group.filter,
      interpolatedQuery.host.filter,
      interpolatedQuery.application.filter,
      interpolatedQuery.itemTag.filter,
      interpolatedQuery.item.filter
    );
    return options;
  }, [
    interpolatedQuery.group.filter,
    interpolatedQuery.host.filter,
    interpolatedQuery.application.filter,
    interpolatedQuery.itemTag.filter,
    interpolatedQuery.item.filter,
  ]);

  // Update suggestions on every metric change
  const groupFilter = interpolatedQuery.group?.filter;
  const hostTagFilters = interpolatedQuery.hostTags;
  const evalType = interpolatedQuery.evaltype;
  const hostFilter = interpolatedQuery.host?.filter;
  const appFilter = interpolatedQuery.application?.filter;
  const tagFilter = interpolatedQuery.itemTag?.filter;
  const itemFilter = interpolatedQuery.item?.filter;

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchHostTags();
  }, [groupFilter]);

  useEffect(() => {
    fetchHosts();
  }, [groupFilter, hostTagFilters, evalType]);

  useEffect(() => {
    fetchApps();
  }, [groupFilter, hostFilter]);

  useEffect(() => {
    fetchTags();
  }, [groupFilter, hostFilter]);

  useEffect(() => {
    fetchItems();
  }, [groupFilter, hostFilter, appFilter, tagFilter, itemFilter]);

  const onFilterChange = (prop: string) => {
    return (value: string) => {
      if (value !== null) {
        onChange({ ...query, [prop]: { filter: value } });
      }
    };
  };

  const onHostTagFilterChange = useCallback(
    (hostTags: HostTagFilter[]) => {
      onChange({ ...query, hostTags: hostTags });
    },
    [onChange, query]
  );

  const onHostTagEvalTypeChange = useCallback(
    (evalType: ZabbixTagEvalType) => {
      onChange({ ...query, evaltype: evalType });
    },
    [onChange, query]
  );

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
            placeholder="Group name"
            createCustomValue={true}
          />
        </InlineField>
        <InlineField label="Host tag" labelWidth={12}>
          <HostTagQueryEditor
            hostTagOptions={hostTagsOptions}
            evalTypeValue={query.evaltype}
            hostTagOptionsLoading={hostTagsLoading}
            onHostTagFilterChange={onHostTagFilterChange}
            onHostTagEvalTypeChange={onHostTagEvalTypeChange}
            version={datasource.zabbix.version}
          />
        </InlineField>
        <InlineField label="Host" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.host.filter}
            options={hostOptions}
            isLoading={hostsLoading}
            onChange={onFilterChange('host')}
            placeholder="Host name"
            createCustomValue={true}
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
              createCustomValue={true}
              placeholder="Application name"
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
              createCustomValue={true}
              placeholder="Item tag name"
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
            createCustomValue={true}
            placeholder="Item name"
          />
        </InlineField>
      </QueryEditorRow>
    </>
  );
};
