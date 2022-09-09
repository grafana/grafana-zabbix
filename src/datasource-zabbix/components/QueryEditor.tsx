import _ from 'lodash';
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, InlineFormLabel, Label, Select } from '@grafana/ui';

import { ZabbixDatasource } from '../datasource';
import {
  ZabbixMetricsQuery,
  ZabbixDSOptions,
  ShowProblemTypes,
  MetricFunc,
  FuncDef,
  ZabbixQueryOptions,
} from '../types';
import * as c from '../constants';
import * as migrations from '../migrations';
import { MetricPicker } from '../../components';
import { ZabbixFunctionEditor } from './ZabbixFunctionEditor';
import { swap } from '../utils';
import { AddZabbixFunction } from './AddZabbixFunction';
import { createFuncInstance } from '../metricFunctions';
import { QueryOptionsEditor } from './QueryOptionsEditor';

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
    let itemOptions: SelectableValue<string>[] = items?.map((item) => ({
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

  // Migrate query on load
  useEffect(() => {
    const migratedQuery = migrations.migrate(query);
    onChange(migratedQuery);
  }, []);

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

  useEffect(() => {
    fetchItems();
  }, [query.group.filter, query.host.filter, query.application.filter, query.itemTag.filter]);

  const onPropChange = (prop: string) => {
    return (option: SelectableValue) => {
      if (option.value) {
        onChangeInternal({ ...query, [prop]: option.value });
      }
    };
  };

  const onFilterChange = (prop: string) => {
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

  const onFuncParamChange = (func: MetricFunc, index: number, value: string) => {
    func.params[index] = value;
    const funcIndex = query.functions.findIndex((f) => f === func);
    const functions = query.functions;
    functions[funcIndex] = func;
    onChangeInternal({ ...query, functions });
  };

  const onMoveFuncLeft = (func: MetricFunc) => {
    const index = query.functions.indexOf(func);
    const functions = swap(query.functions, index, index - 1);
    onChangeInternal({ ...query, functions });
  };

  const onMoveFuncRight = (func: MetricFunc) => {
    const index = query.functions.indexOf(func);
    const functions = swap(query.functions, index, index + 1);
    onChangeInternal({ ...query, functions });
  };

  const onRemoveFunc = (func: MetricFunc) => {
    const functions = query.functions?.filter((f) => f != func);
    onChangeInternal({ ...query, functions });
  };

  const onFuncAdd = (def: FuncDef) => {
    const newFunc = createFuncInstance(def);
    newFunc.added = true;
    let functions = query.functions.concat(newFunc);
    functions = moveAliasFuncLast(functions);

    // if ((newFunc.params.length && newFunc.added) || newFunc.def.params.length === 0) {
    // }
    onChangeInternal({ ...query, functions });
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
          <InlineField label="Application" labelWidth={12}>
            <MetricPicker
              width={24}
              value={query.application.filter}
              options={appOptions}
              isLoading={appsLoading}
              onChange={onFilterChange('application')}
            />
          </InlineField>
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
        <QueryEditorRow>
          <InlineFormLabel width={6}>Functions</InlineFormLabel>
          {query.functions?.map((f, i) => {
            return (
              <ZabbixFunctionEditor
                func={f}
                key={i}
                onParamChange={onFuncParamChange}
                onMoveLeft={onMoveFuncLeft}
                onMoveRight={onMoveFuncRight}
                onRemove={onRemoveFunc}
              />
            );
          })}
          <AddZabbixFunction onFuncAdd={onFuncAdd} />
        </QueryEditorRow>
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

const QueryEditorRow = ({ children }: React.PropsWithChildren<{}>) => {
  return (
    <InlineFieldRow>
      {children}
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow" />
      </div>
    </InlineFieldRow>
  );
};

const getVariableOptions = () => {
  const variables = getTemplateSrv()
    .getVariables()
    .filter((v) => {
      return v.type !== 'datasource' && v.type !== 'interval';
    });
  return variables?.map((v) => ({
    value: `$${v.name}`,
    label: `$${v.name}`,
  }));
};

function moveAliasFuncLast(functions: MetricFunc[]) {
  const aliasFuncIndex = functions.findIndex((func) => func.def.category === 'Alias');

  console.log(aliasFuncIndex);
  if (aliasFuncIndex >= 0) {
    const aliasFunc = functions[aliasFuncIndex];
    functions.splice(aliasFuncIndex, 1);
    functions.push(aliasFunc);
  }
  return functions;
}
