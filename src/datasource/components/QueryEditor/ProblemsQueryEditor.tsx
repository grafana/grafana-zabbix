import _ from 'lodash';
import React, { useEffect, FormEvent } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { InlineField, Input, MultiSelect, Select } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { ZabbixMetricsQuery, ZabbixTagEvalType } from '../../types/query';

const showProblemsOptions: Array<SelectableValue<string>> = [
  { label: 'Problems', value: 'problems' },
  { label: 'Recent problems', value: 'recent' },
  { label: 'History', value: 'history' },
];

const severityOptions: Array<SelectableValue<number>> = [
  { value: 0, label: 'Not classified' },
  { value: 1, label: 'Information' },
  { value: 2, label: 'Warning' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'High' },
  { value: 5, label: 'Disaster' },
];

const evaltypeOptions: Array<SelectableValue<ZabbixTagEvalType>> = [
  { label: 'AND/OR', value: ZabbixTagEvalType.AndOr },
  { label: 'OR', value: ZabbixTagEvalType.Or },
];

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

export const ProblemsQueryEditor = ({ query, datasource, onChange }: Props) => {
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

  // Update suggestions on every metric change
  const groupFilter = datasource.replaceTemplateVars(query.group?.filter);
  const hostFilter = datasource.replaceTemplateVars(query.host?.filter);

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
    fetchProxies();
  }, []);

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

  const onPropChange = (prop: string) => {
    return (option: SelectableValue) => {
      if (option.value !== null) {
        onChange({ ...query, [prop]: option.value });
      }
    };
  };

  const onSeveritiesChange = (options: SelectableValue[]) => {
    if (options !== null) {
      onChange({ ...query, options: { ...query.options, severities: options.map((o) => o.value) } });
    }
  };

  const supportsApplications = datasource.zabbix.supportsApplications();

  return (
    <>
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
        <InlineField label="Proxy" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.proxy?.filter}
            options={proxiesOptions}
            isLoading={proxiesLoading}
            onChange={onFilterChange('proxy')}
          />
        </InlineField>
      </QueryEditorRow>
      <QueryEditorRow>
        {supportsApplications && (
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
            width={36}
            defaultValue={query.tags?.filter}
            placeholder="tag1:value1, tag2:value2"
            onBlur={onTextFilterChange('tags')}
          />
        </InlineField>
        <InlineField>
          <Select
            isSearchable={false}
            width={15}
            value={query.evaltype}
            options={evaltypeOptions}
            onChange={onPropChange('evaltype')}
          />
        </InlineField>
      </QueryEditorRow>
      <QueryEditorRow>
        <InlineField label="Show" labelWidth={12}>
          <Select
            isSearchable={false}
            width={24}
            value={query.showProblems}
            options={showProblemsOptions}
            onChange={onPropChange('showProblems')}
          />
        </InlineField>
        <InlineField label="Severity" labelWidth={12}>
          <MultiSelect
            isSearchable={false}
            isClearable={true}
            placeholder="Show all problems"
            value={query.options?.severities}
            options={severityOptions}
            onChange={onSeveritiesChange}
          />
        </InlineField>
      </QueryEditorRow>
    </>
  );
};
