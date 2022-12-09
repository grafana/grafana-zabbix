import React, { useEffect } from 'react';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import * as c from '../constants';
import * as migrations from '../migrations';
import { ZabbixDatasource } from '../datasource';
import { ShowProblemTypes, ZabbixDSOptions, ZabbixMetricsQuery, ZabbixQueryOptions } from '../types';
import { MetricsQueryEditor } from './QueryEditor/MetricsQueryEditor';
import { QueryFunctionsEditor } from './QueryEditor/QueryFunctionsEditor';
import { QueryOptionsEditor } from './QueryEditor/QueryOptionsEditor';
import { TextMetricsQueryEditor } from './QueryEditor/TextMetricsQueryEditor';
import { ProblemsQueryEditor } from './QueryEditor/ProblemsQueryEditor';
import { ItemIdQueryEditor } from './QueryEditor/ItemIdQueryEditor';
import { ITServicesQueryEditor } from './QueryEditor/ITServicesQueryEditor';
import { TriggersQueryEditor } from './QueryEditor/TriggersQueryEditor';
import { UserMacrosQueryEditor } from './QueryEditor/UserMacrosQueryEditor';
import { CountByMetricsQueryEditor } from './QueryEditor/CountByMetricsQueryEditor';
import { CountByProblemsQueryEditor } from './QueryEditor/CountByProblemsQueryEditor';

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
  {
    value: c.MODE_MACROS,
    label: 'User Macros',
    description: 'User Macros',
  },
  {
    value: c.MODE_TRIGGERS_ITEM,
    label: 'Triggers count by Item',
    description: 'Triggers count by Item',
  },
  {
    value: c.MODE_TRIGGERS_PROBLEM,
    label: 'Triggers count by Problem',
    description: 'Triggers count by Problem',
  },
];

const getDefaultQuery: () => Partial<ZabbixMetricsQuery> = () => ({
  queryType: c.MODE_METRICS,
  group: { filter: '' },
  host: { filter: '' },
  application: { filter: '' },
  itemTag: { filter: '' },
  item: { filter: '' },
  macro: { filter: '' },
  functions: [],
  triggers: {
    count: true,
    minSeverity: 3,
    acknowledged: 2,
  },
  trigger: { filter: '' },
  tags: { filter: '' },
  proxy: { filter: '' },
  textFilter: '',
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

function getSLAQueryDefaults() {
  return {
    itServiceFilter: '',
    slaProperty: 'sla',
    slaInterval: 'none',
  };
}

function getProblemsQueryDefaults(): Partial<ZabbixMetricsQuery> {
  return {
    showProblems: ShowProblemTypes.Problems,
    options: {
      minSeverity: 0,
      sortProblems: 'default',
      acknowledged: 2,
      hostsInMaintenance: false,
      hostProxy: false,
      limit: c.DEFAULT_ZABBIX_PROBLEMS_LIMIT,
      useTimeRange: false,
    },
  };
}

export interface ZabbixQueryEditorProps
  extends QueryEditorProps<ZabbixDatasource, ZabbixMetricsQuery, ZabbixDSOptions> {}

export const QueryEditor = ({ query, datasource, onChange, onRunQuery }: ZabbixQueryEditorProps) => {
  query = { ...getDefaultQuery(), ...query };
  const { queryType } = query;
  if (queryType === c.MODE_PROBLEMS || queryType === c.MODE_TRIGGERS) {
    const defaults = getProblemsQueryDefaults();
    query = { ...defaults, ...query };
    query.options = { ...defaults.options, ...query.options };
  }
  if (queryType === c.MODE_ITSERVICE) {
    query = { ...getSLAQueryDefaults(), ...query };
  }

  // Migrate query on load
  useEffect(() => {
    const migratedQuery = migrations.migrate(query);
    onChange(migratedQuery);
  }, []);

  const onPropChange = (prop: string) => {
    return (option: SelectableValue) => {
      if (option.value !== null) {
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

  const renderMetricsEditor = () => {
    return (
      <>
        <MetricsQueryEditor query={query} datasource={datasource} onChange={onChangeInternal} />
        <QueryFunctionsEditor query={query} onChange={onChangeInternal} />
      </>
    );
  };

  const renderItemIdsEditor = () => {
    return (
      <>
        <ItemIdQueryEditor query={query} onChange={onChangeInternal} />
        <QueryFunctionsEditor query={query} onChange={onChangeInternal} />
      </>
    );
  };

  const renderTextMetricsEditor = () => {
    return (
      <>
        <TextMetricsQueryEditor query={query} datasource={datasource} onChange={onChangeInternal} />
        {/* <QueryFunctionsEditor query={query} onChange={onChangeInternal} /> */}
      </>
    );
  };

  const renderITServicesEditor = () => {
    return (
      <>
        <ITServicesQueryEditor query={query} datasource={datasource} onChange={onChangeInternal} />
        <QueryFunctionsEditor query={query} onChange={onChangeInternal} />
      </>
    );
  };

  const renderProblemsEditor = () => {
    return <ProblemsQueryEditor query={query} datasource={datasource} onChange={onChangeInternal} />;
  };

  const renderTriggersEditor = () => {
    return <TriggersQueryEditor query={query} datasource={datasource} onChange={onChangeInternal} />;
  };

  const renderUserMacrosEditor = () => {
    return <UserMacrosQueryEditor query={query} datasource={datasource} onChange={onChangeInternal} />;
  };

  const renderCountByMetricsEditor = () => {
    return <CountByMetricsQueryEditor query={query} datasource={datasource} onChange={onChangeInternal} />;
  };

  const renderCountByproblemsEditor = () => {
    return <CountByProblemsQueryEditor query={query} datasource={datasource} onChange={onChangeInternal} />;
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
      {queryType === c.MODE_ITEMID && renderItemIdsEditor()}
      {queryType === c.MODE_TEXT && renderTextMetricsEditor()}
      {queryType === c.MODE_ITSERVICE && renderITServicesEditor()}
      {queryType === c.MODE_PROBLEMS && renderProblemsEditor()}
      {queryType === c.MODE_TRIGGERS && renderTriggersEditor()}
      {queryType === c.MODE_MACROS && renderUserMacrosEditor()}
      {queryType === c.MODE_TRIGGERS_ITEM && renderCountByMetricsEditor()}
      {queryType === c.MODE_TRIGGERS_PROBLEM && renderCountByproblemsEditor()}
      <QueryOptionsEditor queryType={queryType} queryOptions={query.options} onChange={onOptionsChange} />
    </>
  );
};
