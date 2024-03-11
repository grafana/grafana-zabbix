import React, { useEffect } from 'react';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, Select } from '@grafana/ui';
import * as c from '../constants';
import { migrate, DS_QUERY_SCHEMA } from '../migrations';
import { ZabbixDatasource } from '../datasource';
import { ShowProblemTypes, ZabbixMetricsQuery, ZabbixQueryOptions, ZabbixTagEvalType, QueryType } from '../types';
import { ZabbixDSOptions } from '../types/config';
import { MetricsQueryEditor } from './QueryEditor/MetricsQueryEditor';
import { QueryFunctionsEditor } from './QueryEditor/QueryFunctionsEditor';
import { QueryOptionsEditor } from './QueryEditor/QueryOptionsEditor';
import { TextMetricsQueryEditor } from './QueryEditor/TextMetricsQueryEditor';
import { ProblemsQueryEditor } from './QueryEditor/ProblemsQueryEditor';
import { ItemIdQueryEditor } from './QueryEditor/ItemIdQueryEditor';
import { ServicesQueryEditor } from './QueryEditor/ServicesQueryEditor';
import { TriggersQueryEditor } from './QueryEditor/TriggersQueryEditor';
import { UserMacrosQueryEditor } from './QueryEditor/UserMacrosQueryEditor';
import { QueryEditorRow } from './QueryEditor/QueryEditorRow';

const zabbixQueryTypeOptions: Array<SelectableValue<QueryType>> = [
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
    label: 'Services',
    description: 'Query services SLA',
  },
  {
    value: c.MODE_ITEMID,
    label: 'Item Id',
    description: 'Query metrics by item ids',
  },
  {
    value: c.MODE_TRIGGERS,
    label: 'Triggers',
    description: 'Count triggers',
  },
  {
    value: c.MODE_PROBLEMS,
    label: 'Problems',
    description: 'Query problems',
  },
  {
    value: c.MODE_MACROS,
    label: 'User macros',
    description: 'User Macros',
  },
];

const getDefaultQuery: () => Partial<ZabbixMetricsQuery> = () => ({
  schema: DS_QUERY_SCHEMA,
  queryType: c.MODE_METRICS,
  group: { filter: '' },
  host: { filter: '' },
  application: { filter: '' },
  itemTag: { filter: '' },
  item: { filter: '' },
  macro: { filter: '' },
  functions: [],
  trigger: { filter: '' },
  countTriggersBy: '',
  tags: { filter: '' },
  proxy: { filter: '' },
  textFilter: '',
  evaltype: ZabbixTagEvalType.AndOr,
  options: {
    showDisabledItems: false,
    skipEmptyValues: false,
    disableDataAlignment: false,
    useZabbixValueMapping: false,
    useTrends: 'default',
    count: false,
  },
  table: {
    skipEmptyValues: false,
  },
});

function getSLAQueryDefaults(): Partial<ZabbixMetricsQuery> {
  return {
    itServiceFilter: '',
    slaFilter: '',
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
      count: false,
    },
  };
}

export interface ZabbixQueryEditorProps
  extends QueryEditorProps<ZabbixDatasource, ZabbixMetricsQuery, ZabbixDSOptions> {}

export const QueryEditor = ({ query, datasource, onChange, onRunQuery }: ZabbixQueryEditorProps) => {
  const queryDefaults = getDefaultQuery();
  query = { ...queryDefaults, ...query };
  query.options = { ...queryDefaults.options, ...query.options };
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
    const migratedQuery = migrate(query);
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
        <ServicesQueryEditor query={query} datasource={datasource} onChange={onChangeInternal} />
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

  return (
    <>
      <QueryEditorRow>
        <InlineField label="Query type" labelWidth={12}>
          <Select<QueryType>
            isSearchable={false}
            width={24}
            value={queryType}
            options={zabbixQueryTypeOptions}
            onChange={onPropChange('queryType')}
          />
        </InlineField>
      </QueryEditorRow>
      {queryType === c.MODE_METRICS && renderMetricsEditor()}
      {queryType === c.MODE_ITEMID && renderItemIdsEditor()}
      {queryType === c.MODE_TEXT && renderTextMetricsEditor()}
      {queryType === c.MODE_ITSERVICE && renderITServicesEditor()}
      {queryType === c.MODE_PROBLEMS && renderProblemsEditor()}
      {queryType === c.MODE_TRIGGERS && renderTriggersEditor()}
      {queryType === c.MODE_MACROS && renderUserMacrosEditor()}
      <QueryOptionsEditor queryType={queryType} queryOptions={query.options} onChange={onOptionsChange} />
    </>
  );
};
