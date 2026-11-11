import { flatten, uniqBy } from 'lodash';
import React, { FormEvent, useCallback, useEffect } from 'react';
import { useAsyncFn } from '../../hooks/useAsyncFn';

import { Combobox, InlineField, ComboboxOption, Input, RadioButtonGroup } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions, processHostTags } from './utils';
import { ZabbixDatasource } from '../../datasource';
import * as c from '../../constants';
import {
  ApmAttributeFilter,
  HostTagFilter,
  LogsSource,
  ZabbixMetricsQuery,
  ZabbixTagEvalType,
} from '../../types/query';
import { ZBXItem, ZBXItemTag } from '../../types';
import { itemTagToString } from '../../utils';
import { HostTagQueryEditor } from './HostTagQueryEditor';
import { ApmAttributeFiltersEditor } from './ApmAttributeFiltersEditor';
import { useInterpolatedQuery } from '../../hooks/useInterpolatedQuery';

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

export const LogsQueryEditor = ({ query, datasource, onChange }: Props) => {
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

    const items = await datasource.zabbix.getAllItems(group, host, null, null, { itemtype: 'log' });
    const tags: ZBXItemTag[] = flatten(items.map((item: ZBXItem) => item.tags || []));

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

  const loadItemOptions = async (group: string, host: string, app: string, itemTag: string) => {
    const options = {
      itemtype: 'log',
      showDisabledItems: query.options.showDisabledItems,
      hostTags: interpolatedQuery.hostTags,
      evaltype: interpolatedQuery.evaltype,
    };
    const items = await datasource.zabbix.getAllItems(group, host, app, itemTag, options);
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
      interpolatedQuery.itemTag.filter
    );
    return options;
  }, [
    interpolatedQuery.group.filter,
    interpolatedQuery.host.filter,
    interpolatedQuery.application.filter,
    interpolatedQuery.itemTag.filter,
    interpolatedQuery.hostTags,
    interpolatedQuery.evaltype,
  ]);

  // Update suggestions on every metric change
  const groupFilter = interpolatedQuery.group?.filter;
  const hostTagFilters = interpolatedQuery.hostTags;
  const evalType = interpolatedQuery.evaltype;
  const hostFilter = interpolatedQuery.host?.filter;
  const appFilter = interpolatedQuery.application?.filter;
  const tagFilter = interpolatedQuery.itemTag?.filter;

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
  }, [groupFilter, hostFilter, appFilter, tagFilter, hostTagFilters, evalType]);

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

  const onApmFilterChange = (prop: string) => {
    return (v: FormEvent<HTMLInputElement>) => {
      const newValue = v?.currentTarget?.value;
      if (newValue !== null) {
        onChange({ ...query, apmFilter: { ...query.apmFilter, [prop]: newValue } });
      }
    };
  };

  const onApmMinSeverityChange = (option: ComboboxOption<number>) => {
    if (option.value !== null) {
      onChange({ ...query, apmFilter: { ...query.apmFilter, minSeverity: option.value } });
    }
  };

  const onApmAttributesChange = useCallback(
    (attributes: ApmAttributeFilter[]) => {
      onChange({ ...query, apmFilter: { ...query.apmFilter, attributes } });
    },
    [onChange, query]
  );

  const supportsApplications = datasource.zabbix.supportsApplications();
  const logsSource: LogsSource = query.logsSource || c.LOGS_SOURCE_ITEM;
  const apmSupported = datasource.zabbix.supportsApmLogsSync();

  const logsSourceOptions = [
    {
      label: 'Item logs',
      value: c.LOGS_SOURCE_ITEM as LogsSource,
      description: 'History of items with the Log value type',
    },
    {
      label: 'APM logs',
      value: c.LOGS_SOURCE_APM as LogsSource,
      description: apmSupported
        ? 'OpenTelemetry logs collected via APM (Zabbix 8.0+)'
        : 'Requires Zabbix 8.0 or higher',
    },
  ];

  // OTEL SeverityNumber lower bounds
  const minSeverityOptions: Array<ComboboxOption<number>> = [
    { value: 0, label: 'Any' },
    { value: 1, label: 'Trace' },
    { value: 5, label: 'Debug' },
    { value: 9, label: 'Info' },
    { value: 13, label: 'Warn' },
    { value: 17, label: 'Error' },
    { value: 21, label: 'Fatal' },
  ];

  const renderApmLogsEditor = () => {
    return (
      <>
        <QueryEditorRow>
          <InlineField
            label="Service"
            labelWidth={12}
            tooltip="Exact service name (OTEL service.name resource attribute). Supports template variables."
          >
            <Input
              width={24}
              defaultValue={query.apmFilter?.service}
              onBlur={onApmFilterChange('service')}
              placeholder="Service name"
            />
          </InlineField>
          <InlineField label="Min severity" labelWidth={12}>
            <Combobox
              width={16}
              value={query.apmFilter?.minSeverity ?? 0}
              options={minSeverityOptions}
              onChange={onApmMinSeverityChange}
            />
          </InlineField>
        </QueryEditorRow>
        <QueryEditorRow>
          <InlineField
            label="Body"
            labelWidth={12}
            tooltip="Case-insensitive substring match on the log body (server side). Supports template variables."
          >
            <Input
              width={24}
              defaultValue={query.textFilter}
              onBlur={onTextFilterChange}
              placeholder="Text to search in log body"
            />
          </InlineField>
          <InlineField label="Trace ID" labelWidth={12}>
            <Input
              width={24}
              defaultValue={query.apmFilter?.traceId}
              onBlur={onApmFilterChange('traceId')}
              placeholder="Trace ID"
            />
          </InlineField>
        </QueryEditorRow>
        <QueryEditorRow>
          <InlineField
            label="Attributes"
            labelWidth={12}
            tooltip="Filter by OTEL resource, scope, or log record attributes."
          >
            <ApmAttributeFiltersEditor value={query.apmFilter?.attributes} onChange={onApmAttributesChange} />
          </InlineField>
        </QueryEditorRow>
      </>
    );
  };

  return (
    <>
      <QueryEditorRow>
        <InlineField label="Source" labelWidth={12}>
          <RadioButtonGroup
            options={logsSourceOptions}
            value={logsSource}
            onChange={(v: LogsSource) => onChange({ ...query, logsSource: v })}
          />
        </InlineField>
      </QueryEditorRow>
      {logsSource === c.LOGS_SOURCE_APM && renderApmLogsEditor()}
      {logsSource === c.LOGS_SOURCE_ITEM && (
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
          <QueryEditorRow>
            <InlineField label="Line filter" labelWidth={12}>
              <Input
                width={24}
                defaultValue={query.textFilter}
                onBlur={onTextFilterChange}
                placeholder="Regex to filter log lines"
              />
            </InlineField>
          </QueryEditorRow>
        </>
      )}
    </>
  );
};
