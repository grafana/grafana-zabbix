import _ from 'lodash';
import React, { useEffect, FormEvent } from 'react';
import { useAsyncFn } from 'react-use';
import { AnnotationQuery, SelectableValue } from '@grafana/data';
import { InlineField, InlineSwitch, Input, Select } from '@grafana/ui';
import { ZabbixMetricsQuery } from '../types/query';
import { ZabbixQueryEditorProps } from './QueryEditor';
import { QueryEditorRow } from './QueryEditor/QueryEditorRow';
import { MetricPicker } from '../../components';
import { getVariableOptions } from './QueryEditor/utils';
import { prepareAnnotation } from '../migrations';

const severityOptions: Array<SelectableValue<number>> = [
  { value: 0, label: 'Not classified' },
  { value: 1, label: 'Information' },
  { value: 2, label: 'Warning' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'High' },
  { value: 5, label: 'Disaster' },
];

type Props = ZabbixQueryEditorProps & {
  annotation?: AnnotationQuery<ZabbixMetricsQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<ZabbixMetricsQuery>) => void;
};

export const AnnotationQueryEditor = ({ annotation, onAnnotationChange, datasource }: Props) => {
  annotation = prepareAnnotation(annotation);
  const query = annotation.target;

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

  const onChange = (query: any) => {
    onAnnotationChange({
      ...annotation,
      target: query,
    });
  };

  const onFilterChange = (prop: string) => {
    return (value: string) => {
      if (value !== null) {
        onChange({ ...query, [prop]: { filter: value } });
      }
    };
  };

  const onTextFilterChange = (prop: string) => {
    return (v: FormEvent<HTMLInputElement>) => {
      const newValue = v?.currentTarget?.value;
      if (newValue !== null) {
        onChange({ ...query, [prop]: { filter: newValue } });
      }
    };
  };

  const onMinSeverityChange = (option: SelectableValue) => {
    if (option.value !== null) {
      onChange({ ...query, options: { ...query.options, minSeverity: option.value } });
    }
  };

  const onOptionSwitch = (prop: string) => () => {
    onChange({ ...query, options: { ...query.options, [prop]: !query.options[prop] } });
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
      </QueryEditorRow>
      <>
        <InlineField label="Min severity" labelWidth={12}>
          <Select
            isSearchable={false}
            width={24}
            value={query.options?.minSeverity}
            options={severityOptions}
            onChange={onMinSeverityChange}
          />
        </InlineField>
        <InlineField label="Show OK events" labelWidth={24}>
          <InlineSwitch value={query.options.showOkEvents} onChange={onOptionSwitch('showOkEvents')} />
        </InlineField>
        <InlineField label="Hide acknowledged events" labelWidth={24}>
          <InlineSwitch value={query.options.hideAcknowledged} onChange={onOptionSwitch('hideAcknowledged')} />
        </InlineField>
        <InlineField label="Show hostname" labelWidth={24}>
          <InlineSwitch value={query.options.showHostname} onChange={onOptionSwitch('showHostname')} />
        </InlineField>
      </>
    </>
  );
};
