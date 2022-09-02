import React, { useEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { AsyncSelect, InlineField, InlineFieldRow, Select } from '@grafana/ui';
import { ZabbixDatasource } from '../datasource';
import { ZabbixMetricsQuery, ZabbixDSOptions, ShowProblemTypes } from '../types';
import * as c from '../constants';
import { MetricPicker } from '../../components';

const zabbixQueryTypeOptions: Array<SelectableValue<string>> = [
  {
    value: c.MODE_METRICS,
    label: 'Metrics',
    description: 'Query numeric metrics',
  },
  {
    value: c.MODE_TEXT,
    label: 'Text',
    description: 'Query text data',
  },
  {
    value: c.MODE_ITSERVICE,
    label: 'IT Services',
    description: 'Query IT Services data',
  },
  {
    value: c.MODE_ITEMID,
    label: 'Item Id',
    description: 'Query metrics by item ids',
  },
  {
    value: c.MODE_TRIGGERS,
    label: 'Triggers',
    description: 'Query triggers data',
  },
  {
    value: c.MODE_PROBLEMS,
    label: 'Problems',
    description: 'Query problems',
  },
];

const getDefaultQuery = () => ({
  queryType: c.MODE_METRICS,
  group: { filter: '' },
  host: { filter: '' },
  application: { filter: '' },
  itemTag: { filter: '' },
  item: { filter: '' },
  functions: [],
  triggers: {
    count: true,
    minSeverity: 3,
    acknowledged: 2,
  },
  trigger: { filter: '' },
  tags: { filter: '' },
  proxy: { filter: '' },
  options: {
    showDisabledItems: false,
    skipEmptyValues: false,
    disableDataAlignment: false,
    useZabbixValueMapping: false,
  },
  table: {
    skipEmptyValues: false,
  },
});

function getSLATargetDefaults() {
  return {
    slaProperty: { name: 'SLA', property: 'sla' },
    slaInterval: 'none',
  };
}

function getProblemsTargetDefaults() {
  return {
    showProblems: ShowProblemTypes.Problems,
    options: {
      minSeverity: 0,
      sortProblems: 'default',
      acknowledged: 2,
      hostsInMaintenance: false,
      hostProxy: false,
      limit: c.DEFAULT_ZABBIX_PROBLEMS_LIMIT,
    },
  };
}

export interface Props extends QueryEditorProps<ZabbixDatasource, ZabbixMetricsQuery, ZabbixDSOptions> {}

export const QueryEditor = ({ query, datasource, onChange, onRunQuery }: Props) => {
  query = { ...getDefaultQuery(), ...query };
  const { queryType } = query;

  const loadGroupOptions = async () => {
    const groups = await datasource.zabbix.getAllGroups();
    return groups?.map((group) => ({
      value: group.name,
      label: group.name,
    }));
  };

  const [{ loading: groupsLoading, value: groupsOptions }, fetchGroups] = useAsyncFn(async () => {
    const options = await loadGroupOptions();
    return options;
  }, []);

  const loadHostOptions = async (group: string) => {
    const groupFilter = datasource.replaceTemplateVars(group);
    const hosts = await datasource.zabbix.getAllHosts(groupFilter);
    const options: SelectableValue<string>[] = hosts?.map((host) => ({
      value: host.name,
      label: host.name,
    }));
    return options;
  };

  const [{ loading: hostsLoading, value: hostOptions }, fetchHosts] = useAsyncFn(async () => {
    const options = await loadHostOptions(query.group.filter);
    return options;
  }, [query.group.filter]);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchHosts();
  }, [query.group.filter]);

  const onPropChange = (prop: string) => {
    return (option: SelectableValue) => {
      if (option.value) {
        onChangeInternal({ ...query, [prop]: option.value });
      }
    };
  };

  const onFilterChange = (prop: string) => {
    return (option: SelectableValue<string>) => {
      if (option.value) {
        onChangeInternal({ ...query, [prop]: { filter: option.value } });
      }
    };
  };

  const onMetricChange = (prop: string) => {
    return (value: string) => {
      if (value) {
        onChangeInternal({ ...query, [prop]: { filter: value } });
      }
    };
  };

  const onChangeInternal = (query: ZabbixMetricsQuery) => {
    onChange(query);
    onRunQuery();
  };

  const getSelectableValue = (value: string): SelectableValue<string> => {
    return { value, label: value };
  };

  const renderMetricsEditor = () => {
    return (
      <>
        <InlineFieldRow>
          <InlineField label="Group" labelWidth={16}>
            <MetricPicker
              value={query.group.filter}
              options={groupsOptions}
              isLoading={groupsLoading}
              onChange={onMetricChange('group')}
            />
            {/* <AsyncSelect
              defaultOptions
              isSearchable
              allowCustomValue
              width={24}
              value={getSelectableValue(query.group.filter)}
              loadOptions={loadGroupOptions}
              onChange={onFilterChange('group')}
            /> */}
          </InlineField>
          <InlineField label="Host" labelWidth={16}>
            <MetricPicker
              value={query.host.filter}
              options={hostOptions}
              isLoading={hostsLoading}
              onChange={onMetricChange('host')}
            />
          </InlineField>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </InlineFieldRow>
      </>
    );
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query type" labelWidth={16}>
          <Select
            isSearchable={false}
            width={24}
            value={queryType}
            options={zabbixQueryTypeOptions}
            onChange={onPropChange('queryType')}
          />
        </InlineField>
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label gf-form-label--grow" />
        </div>
      </InlineFieldRow>
      {queryType === c.MODE_METRICS && renderMetricsEditor()}
    </>
  );
};
