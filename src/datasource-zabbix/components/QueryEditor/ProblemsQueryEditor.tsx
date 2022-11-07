import _ from 'lodash';
import React, { useEffect, FormEvent } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { InlineField, Input, Select } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { ZabbixMetricsQuery, ZabbixDSOptions } from '../../types';

const showProblemsOptions: SelectableValue<string>[] = [
  { label: 'Problems', value: 'problems' },
  { label: 'Recent problems', value: 'recent' },
  { label: 'History', value: 'history' },
];

const severityOptions: SelectableValue<number>[] = [
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
    let options: SelectableValue<string>[] = hosts?.map((host) => ({
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
    let options: SelectableValue<string>[] = apps?.map((app) => ({
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

  // Update suggestions on every metric change
  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchHosts();
  }, [query.group.filter]);

  useEffect(() => {
    fetchApps();
  }, [query.group.filter, query.host.filter]);

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

  const onMinSeverityChange = (option: SelectableValue) => {
    if (option.value !== null) {
      onChange({ ...query, options: { ...query.options, minSeverity: option.value } });
    }
  };

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
          <Input width={24} defaultValue={query.proxy?.filter} onBlur={onTextFilterChange('proxy')} />
        </InlineField>
      </QueryEditorRow>
      <QueryEditorRow>
        <InlineField label="Application" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.application?.filter}
            options={appOptions}
            isLoading={appsLoading}
            onChange={onFilterChange('application')}
          />
        </InlineField>
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
        <InlineField label="Min severity" labelWidth={12}>
          <Select
            isSearchable={false}
            width={24}
            value={query.options?.minSeverity}
            options={severityOptions}
            onChange={onMinSeverityChange}
          />
        </InlineField>
      </QueryEditorRow>
    </>
  );
};
