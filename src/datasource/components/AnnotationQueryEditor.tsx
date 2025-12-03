import _ from 'lodash';
import React, { useEffect, FormEvent } from 'react';
import { useAsyncFn } from 'react-use';
import { AnnotationQuery, SelectableValue } from '@grafana/data';
import { Combobox, ComboboxOption, InlineField, InlineSwitch, Input } from '@grafana/ui';
import { ZabbixMetricsQuery } from '../types/query';
import { ZabbixQueryEditorProps } from './QueryEditor';
import { QueryEditorRow } from './QueryEditor/QueryEditorRow';
import { MetricPicker } from '../../components';
import { getVariableOptions } from './QueryEditor/utils';
import { prepareAnnotation } from '../migrations';
import { useInterpolatedQuery } from '../hooks/useInterpolatedQuery';

const severityOptions: Array<ComboboxOption<number>> = [
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
  const interpolatedQuery = useInterpolatedQuery(datasource, query);

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
    const hosts = await datasource.zabbix.getAllHosts(group);
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
    const options = await loadHostOptions(interpolatedQuery.group.filter);
    return options;
  }, [interpolatedQuery.group.filter]);

  const loadAppOptions = async (group: string, host: string) => {
    const apps = await datasource.zabbix.getAllApps(group, host);
    let options: Array<SelectableValue<string>> = apps?.map((app) => ({
      value: app.name,
      label: app.name,
    }));
    options = _.uniqBy(options, (o) => o.value);
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: appsLoading, value: appOptions }, fetchApps] = useAsyncFn(async () => {
    const options = await loadAppOptions(interpolatedQuery.group.filter, interpolatedQuery.host.filter);
    return options;
  }, [interpolatedQuery.group.filter, interpolatedQuery.host.filter]);

  // Update suggestions on every metric change
  const groupFilter = interpolatedQuery.group?.filter;
  const hostFilter = interpolatedQuery.host?.filter;

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
          <Combobox
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
