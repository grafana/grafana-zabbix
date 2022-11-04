import React, { useEffect } from 'react';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import * as c from '../constants';
import * as migrations from '../migrations';
import { ZabbixDatasource } from '../datasource';
import { MetricFunc, ShowProblemTypes, ZabbixDSOptions, ZabbixMetricsQuery, ZabbixQueryOptions } from '../types';
import { MetricsQueryEditor } from './QueryEditor/MetricsQueryEditor';
import { QueryFunctionsEditor } from './QueryEditor/QueryFunctionsEditor';
import { QueryOptionsEditor } from './QueryEditor/QueryOptionsEditor';

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
  // Migrate query on load
  useEffect(() => {
    const migratedQuery = migrations.migrate(query);
    onChange(migratedQuery);
  }, []);

  const onPropChange = (prop: string) => {
    return (option: SelectableValue) => {
      if (option.value) {
        onChangeInternal({ ...query, [prop]: option.value });
      }
    };
  };

  const onChangeInternal = (query: ZabbixMetricsQuery) => {
    onChange(query);
    onRunQuery();
  };

  const onOptionsChange = (options: ZabbixQueryOptions) => {
    onChangeInternal({ ...query, options });
  };

  const getSelectableValue = (value: string): SelectableValue<string> => {
    return { value, label: value };
  };

  const renderMetricsEditor = () => {
    return (
      <>
        <MetricsQueryEditor query={query} datasource={datasource} onChange={onChangeInternal} />
        <QueryFunctionsEditor query={query} onChange={onChangeInternal} />
      </>
    );
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query type" labelWidth={12}>
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
      <QueryOptionsEditor queryType={queryType} queryOptions={query.options} onChange={onOptionsChange} />
    </>
  );
};
