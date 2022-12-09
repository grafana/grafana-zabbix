import _ from 'lodash';
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { InlineField } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { ZabbixMetricsQuery } from '../../types';

export interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

export const UserMacrosQueryEditor = ({ query, datasource, onChange }: Props) => {
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

  const loadMacrosOptions = async (group: string, host: string) => {
    const groupFilter = datasource.replaceTemplateVars(group);
    const hostFilter = datasource.replaceTemplateVars(host);
    const macros = await datasource.zabbix.getAllMacros(groupFilter, hostFilter);
    let options: Array<SelectableValue<string>> = macros?.map((m) => ({
      value: m.name,
      label: m.name,
    }));
    options = _.uniqBy(options, (o) => o.value);
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: macrosLoading, value: macrosOptions }, fetchmacros] = useAsyncFn(async () => {
    const options = await loadMacrosOptions(query.group.filter, query.host.filter);
    return options;
  }, [query.group.filter, query.host.filter]);

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
    fetchmacros();
  }, [groupFilter, hostFilter]);

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
        <InlineField label="Macros" labelWidth={12}>
          <MetricPicker
            width={24}
            value={query.macro.filter}
            options={macrosOptions}
            isLoading={macrosLoading}
            onChange={onFilterChange('macro')}
          />
        </InlineField>
      </QueryEditorRow>
    </>
  );
};
