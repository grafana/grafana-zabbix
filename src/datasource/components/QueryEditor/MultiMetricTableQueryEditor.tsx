import React, { useCallback, useEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { uniqBy } from 'lodash';
import { Button, Checkbox, InlineField, InlineFieldRow, Input, RadioButtonGroup, Select, Stack, Icon, ComboboxOption } from '@grafana/ui';
import { ZabbixMetricsQuery, MetricColumnConfig, HostTagFilter, ZabbixTagEvalType } from '../../types/query';
import { ZabbixDatasource } from '../../datasource';
import { MetricPicker } from '../../../components/MetricPicker/MetricPicker';
import { HostTagQueryEditor } from './HostTagQueryEditor';
import { getVariableOptions, processHostTags } from './utils';
import { useInterpolatedQuery } from '../../hooks/useInterpolatedQuery';

interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

const searchTypeOptions = [
  { label: 'Item Name', value: 'itemName' },
  { label: 'Item Key', value: 'itemKey' },
];

const aggregationOptions = [
  { label: 'Last', value: 'last' },
  { label: 'Average', value: 'avg' },
  { label: 'Minimum', value: 'min' },
  { label: 'Maximum', value: 'max' },
  { label: 'Sum', value: 'sum' },
  { label: 'Median', value: 'median' },
  { label: '95th Percentile', value: 'p95' },
];

export const MultiMetricTableQueryEditor = ({ query, datasource, onChange }: Props) => {
  const interpolatedQuery = useInterpolatedQuery(datasource, query);

  // Ensure defaults
  const safeQuery: ZabbixMetricsQuery = {
    ...query,
    group: query.group || { filter: '' },
    host: query.host || { filter: '' },
    hostTags: query.hostTags || [],
    application: query.application || { filter: '' },
    itemTag: query.itemTag || { filter: '' },
    tableConfig: query.tableConfig || {
      entityPattern: {
        searchType: 'itemName',
        pattern: '',
        extractPattern: '',
        extractedColumns: [],
      },
      metrics: [],
      showGroupColumn: false,
      showHostColumn: false,
    },
  };

  const tableConfig = safeQuery.tableConfig!;

  // Local state for entity pattern (with onBlur)
  const [localEntityPattern, setLocalEntityPattern] = useState(tableConfig.entityPattern.pattern);
  const [localExtractPattern, setLocalExtractPattern] = useState(tableConfig.entityPattern.extractPattern || '');

  // Local state for metric fields
  const [localMetrics, setLocalMetrics] = useState(
    tableConfig.metrics.map((m) => ({ columnName: m.columnName, pattern: m.pattern }))
  );

  // Load group options
  const loadGroupOptions = async () => {
    const groups = await datasource.zabbix.getAllGroups();
    const options = groups?.map((group) => ({
      value: group.name,
      label: group.name,
    }));
    if (options.length > 0) {
      options.unshift({ value: '/.*/' });
    }
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: groupsLoading, value: groupsOptions }, fetchGroups] = useAsyncFn(async () => {
    const options = await loadGroupOptions();
    return options;
  }, []);

  // Load host tag options
  const loadHostTagOptions = async (group: string) => {
    const hostsWithTags = await datasource.zabbix.getAllHosts(group, true);
    const hostTags = processHostTags(hostsWithTags ?? []);
    let options: Array<ComboboxOption<string>> = hostTags?.map((tag) => ({
      value: tag.tag,
      label: tag.tag,
    }));
    return options;
  };

  const [{ loading: hostTagsLoading, value: hostTagsOptions }, fetchHostTags] = useAsyncFn(async () => {
    const options = await loadHostTagOptions(query.group.filter);
    return options;
  }, [query.group.filter]);

  // Load host options
  const loadHostOptions = async (group: string, hostTags?: HostTagFilter[], evalType?: ZabbixTagEvalType) => {
    const hosts = await datasource.zabbix.getAllHosts(group, false, hostTags, evalType);
    let options: Array<ComboboxOption<string>> = hosts?.map((host) => ({
      value: host.name,
      label: host.name,
    }));
    options = uniqBy(options, (o) => o.value);
    if (options.length > 0) {
      options.unshift({ value: '/.*/' });
    }
    options.unshift(...getVariableOptions());
    return options;
  };

  const [{ loading: hostsLoading, value: hostOptions }, fetchHosts] = useAsyncFn(async () => {
    const options = await loadHostOptions(
      interpolatedQuery.group.filter,
      interpolatedQuery.hostTags,
      interpolatedQuery.evaltype
    );
    return options;
  }, [interpolatedQuery.group.filter, interpolatedQuery.hostTags, interpolatedQuery.evaltype]);

  // Sync local state when query changes externally
  useEffect(() => {
    setLocalEntityPattern(tableConfig.entityPattern.pattern);
    setLocalExtractPattern(tableConfig.entityPattern.extractPattern || '');
  }, [tableConfig.entityPattern.pattern, tableConfig.entityPattern.extractPattern]);

  useEffect(() => {
    setLocalMetrics(tableConfig.metrics.map((m) => ({ columnName: m.columnName, pattern: m.pattern })));
  }, [tableConfig.metrics.length]);

  // Fetch options on mount and when dependencies change
  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchHostTags();
  }, [query.group.filter]);

  useEffect(() => {
    fetchHosts();
  }, [interpolatedQuery.group.filter, interpolatedQuery.hostTags, interpolatedQuery.evaltype]);

  const onGroupChange = (value: string) => {
    onChange({
      ...safeQuery,
      group: { filter: value || '' },
      host: { filter: '' },
    });
  };

  const onHostTagFilterChange = useCallback(
    (hostTags: HostTagFilter[]) => {
      onChange({ ...safeQuery, hostTags: hostTags });
    },
    [onChange, safeQuery]
  );

  const onHostTagEvalTypeChange = useCallback(
    (evalType: ZabbixTagEvalType) => {
      onChange({ ...safeQuery, evaltype: evalType });
    },
    [onChange, safeQuery]
  );

  const onHostChange = (value: string) => {
    onChange({
      ...safeQuery,
      host: { filter: value || '' },
    });
  };

  const onEntityPatternBlur = () => {
    if (
      localEntityPattern !== tableConfig.entityPattern.pattern ||
      localExtractPattern !== (tableConfig.entityPattern.extractPattern || '')
    ) {
      onChange({
        ...safeQuery,
        tableConfig: {
          ...tableConfig,
          entityPattern: {
            ...tableConfig.entityPattern,
            pattern: localEntityPattern,
            extractPattern: localExtractPattern,
          },
        },
      });
    }
  };

  const onExtractedColumnAdd = () => {
    const extractedColumns = tableConfig.entityPattern.extractedColumns || [];
    const newColumn = {
      name: 'Captured Field',
      groupIndex: extractedColumns.length + 1,
    };

    onChange({
      ...safeQuery,
      tableConfig: {
        ...tableConfig,
        entityPattern: {
          ...tableConfig.entityPattern,
          extractedColumns: [...extractedColumns, newColumn],
        },
      },
    });
  };

  const onExtractedColumnChange = (index: number, field: 'name' | 'groupIndex', value: string | number) => {
    const extractedColumns = [...(tableConfig.entityPattern.extractedColumns || [])];
    extractedColumns[index] = { ...extractedColumns[index], [field]: value };

    onChange({
      ...safeQuery,
      tableConfig: {
        ...tableConfig,
        entityPattern: {
          ...tableConfig.entityPattern,
          extractedColumns,
        },
      },
    });
  };

  const onExtractedColumnRemove = (index: number) => {
    const extractedColumns = (tableConfig.entityPattern.extractedColumns || []).filter((_, i) => i !== index);

    onChange({
      ...safeQuery,
      tableConfig: {
        ...tableConfig,
        entityPattern: {
          ...tableConfig.entityPattern,
          extractedColumns,
        },
      },
    });
  };

  const onMetricChange = (index: number, field: keyof MetricColumnConfig, value: any) => {
    const newMetrics = [...tableConfig.metrics];
    newMetrics[index] = { ...newMetrics[index], [field]: value };

    if (field === 'columnName' || field === 'pattern') {
      const newLocalMetrics = [...localMetrics];
      if (!newLocalMetrics[index]) {
        newLocalMetrics[index] = { columnName: '', pattern: '' };
      }
      newLocalMetrics[index] = { ...newLocalMetrics[index], [field]: value };
      setLocalMetrics(newLocalMetrics);
    }

    if (field !== 'columnName' && field !== 'pattern') {
      onChange({
        ...safeQuery,
        tableConfig: {
          ...tableConfig,
          metrics: newMetrics,
        },
      });
    }
  };

  const onMetricBlur = (index: number) => {
    const currentMetric = tableConfig.metrics[index];
    const localMetric = localMetrics[index];

    if (
      localMetric &&
      (currentMetric.columnName !== localMetric.columnName || currentMetric.pattern !== localMetric.pattern)
    ) {
      const newMetrics = [...tableConfig.metrics];
      newMetrics[index] = {
        ...newMetrics[index],
        columnName: localMetric.columnName,
        pattern: localMetric.pattern,
      };

      onChange({
        ...safeQuery,
        tableConfig: {
          ...tableConfig,
          metrics: newMetrics,
        },
      });
    }
  };

  const onMetricAdd = () => {
    const newMetric: MetricColumnConfig = {
      columnName: 'New Column',
      searchType: 'itemName',
      pattern: '',
      aggregation: 'last',
    };
    onChange({
      ...safeQuery,
      tableConfig: {
        ...tableConfig,
        metrics: [...tableConfig.metrics, newMetric],
      },
    });

    setLocalMetrics([...localMetrics, { columnName: 'New Column', pattern: '' }]);
  };

  const onMetricRemove = (index: number) => {
    const newMetrics = tableConfig.metrics.filter((_, i) => i !== index);
    onChange({
      ...safeQuery,
      tableConfig: {
        ...tableConfig,
        metrics: newMetrics,
      },
    });

    const newLocalMetrics = localMetrics.filter((_, i) => i !== index);
    setLocalMetrics(newLocalMetrics);
  };

  const extractedColumns = tableConfig.entityPattern.extractedColumns || [];

  return (
    <Stack direction="column" gap={2}>
      {/* First row: Group, Host tag, Host - matching MetricsQueryEditor */}
      <InlineFieldRow>
        <InlineField label="Group" labelWidth={12}>
          <MetricPicker
            width={24}
            value={safeQuery.group.filter}
            options={groupsOptions}
            isLoading={groupsLoading}
            placeholder="Group name"
            createCustomValue={true}
            onChange={onGroupChange}
          />
        </InlineField>
        <InlineField label="Host tag" labelWidth={12}>
          <HostTagQueryEditor
            hostTagOptions={hostTagsOptions}
            evalTypeValue={safeQuery.evaltype}
            hostTagOptionsLoading={hostTagsLoading}
            onHostTagFilterChange={onHostTagFilterChange}
            onHostTagEvalTypeChange={onHostTagEvalTypeChange}
            version={datasource.zabbix.version}
          />
        </InlineField>
        <InlineField label="Host" labelWidth={12}>
          <MetricPicker
            width={24}
            value={safeQuery.host.filter}
            options={hostOptions}
            isLoading={hostsLoading}
            placeholder="Host name"
            createCustomValue={true}
            onChange={onHostChange}
          />
        </InlineField>
      </InlineFieldRow>

      {/* Second row: Checkboxes */}
      <InlineFieldRow>
        <InlineField label="Show Group column" labelWidth={20}>
          <Checkbox
            value={tableConfig.showGroupColumn || false}
            onChange={(e) => {
              onChange({
                ...safeQuery,
                tableConfig: {
                  ...tableConfig,
                  showGroupColumn: e.currentTarget.checked,
                },
              });
            }}
          />
        </InlineField>
        <InlineField label="Show Host column" labelWidth={20}>
          <Checkbox
            value={tableConfig.showHostColumn || false}
            onChange={(e) => {
              onChange({
                ...safeQuery,
                tableConfig: {
                  ...tableConfig,
                  showHostColumn: e.currentTarget.checked,
                },
              });
            }}
          />
        </InlineField>
      </InlineFieldRow>

      {/* Entity Pattern Section */}
      <div style={{ borderTop: '1px solid #444', paddingTop: '16px', marginTop: '16px' }}>
        <h6 style={{ marginBottom: '8px' }}>Entity Pattern (defines table rows)</h6>
        <Stack direction="column" gap={1}>
          <InlineFieldRow>
            <InlineField label="Search by" labelWidth={16}>
              <RadioButtonGroup
                value={tableConfig.entityPattern.searchType}
                options={searchTypeOptions}
                onChange={(value) =>
                  onChange({
                    ...safeQuery,
                    tableConfig: {
                      ...tableConfig,
                      entityPattern: {
                        ...tableConfig.entityPattern,
                        searchType: value as 'itemName' | 'itemKey',
                      },
                    },
                  })
                }
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Pattern" labelWidth={16} grow>
              <Input
                value={localEntityPattern}
                placeholder="e.g., /Interface.*/ or /.*: Disk .*/ or /FS .*: .*/"
                onChange={(e) => setLocalEntityPattern(e.currentTarget.value)}
                onBlur={onEntityPatternBlur}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label="Extract pattern"
              labelWidth={16}
              grow
              tooltip="Optional: Regex with capture groups, e.g., 'Interface (.*)\[(.*)\]: .*'"
            >
              <Input
                value={localExtractPattern}
                placeholder="Regex with capture groups, e.g., 'Interface (.*)\[(.*)\]: .*'"
                onChange={(e) => setLocalExtractPattern(e.currentTarget.value)}
                onBlur={onEntityPatternBlur}
              />
            </InlineField>
          </InlineFieldRow>

          {/* Extracted Columns Section */}
          {localExtractPattern && (
            <div style={{ marginTop: '8px', marginLeft: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <h6 style={{ margin: 0, fontSize: '12px' }}>
                  <Icon name="arrow-right" /> Extracted Columns (from capture groups)
                </h6>
              </div>
              <Stack direction="column" gap={1}>
                {extractedColumns.map((col, index) => (
                  <InlineFieldRow key={index}>
                    <InlineField label="Column name" labelWidth={16}>
                      <Input
                        width={30}
                        value={col.name}
                        placeholder="Column name"
                        onChange={(e) => onExtractedColumnChange(index, 'name', e.currentTarget.value)}
                      />
                    </InlineField>
                    <InlineField label="Capture group" labelWidth={16}>
                      <Input
                        width={10}
                        type="number"
                        min={1}
                        value={col.groupIndex}
                        onChange={(e) =>
                          onExtractedColumnChange(index, 'groupIndex', parseInt(e.currentTarget.value, 10))
                        }
                      />
                    </InlineField>
                    <Button
                      size="sm"
                      variant="destructive"
                      icon="trash-alt"
                      aria-label="Remove extracted column"
                      onClick={() => onExtractedColumnRemove(index)}
                    />
                  </InlineFieldRow>
                ))}
                <Button size="sm" icon="plus" variant="secondary" onClick={onExtractedColumnAdd}>
                  Add extracted column
                </Button>
              </Stack>
            </div>
          )}
        </Stack>
      </div>

      {/* Metrics Section */}
      <div style={{ borderTop: '1px solid #444', paddingTop: '16px', marginTop: '16px' }}>
        <h6 style={{ marginBottom: '8px' }}>Metric Columns</h6>
        <Stack direction="column" gap={1}>
          {tableConfig.metrics.map((metric, index) => (
            <InlineFieldRow key={index}>
              <InlineField label="Column" labelWidth={16}>
                <Input
                  width={20}
                  value={localMetrics[index]?.columnName ?? metric.columnName}
                  placeholder="Column name"
                  onChange={(e) => onMetricChange(index, 'columnName', e.currentTarget.value)}
                  onBlur={() => onMetricBlur(index)}
                />
              </InlineField>
              <InlineField label="Search by" labelWidth={16}>
                <RadioButtonGroup
                  value={metric.searchType}
                  options={searchTypeOptions}
                  onChange={(value) => onMetricChange(index, 'searchType', value)}
                />
              </InlineField>
              <InlineField label="Pattern" labelWidth={16} grow>
                <Input
                  value={localMetrics[index]?.pattern ?? metric.pattern}
                  placeholder="e.g., /.*Status/"
                  onChange={(e) => onMetricChange(index, 'pattern', e.currentTarget.value)}
                  onBlur={() => onMetricBlur(index)}
                />
              </InlineField>
              <InlineField label="Aggregation" labelWidth={16}>
                <Select
                  width={15}
                  value={metric.aggregation}
                  options={aggregationOptions}
                  onChange={(option) => onMetricChange(index, 'aggregation', option.value!)}
                />
              </InlineField>
              <Button
                size="sm"
                variant="destructive"
                icon="trash-alt"
                aria-label="Remove metric"
                onClick={() => onMetricRemove(index)}
              />
            </InlineFieldRow>
          ))}
          <Button size="sm" icon="plus" onClick={onMetricAdd}>
            Add metric column
          </Button>
        </Stack>
      </div>

      {/* Help text */}
      <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(50, 116, 217, 0.1)', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '12px' }}>
          <strong>How it works:</strong> Select Group/Host, define entity pattern for rows, optionally extract columns
          from regex capture groups, then add metric columns.
        </p>
        <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
          <strong>Example:</strong> Pattern: "/Interface.*/", Extract: "Interface (.*)\[(.*)\]" - Group 1: "Interface
          name", Group 2: "Description"
        </p>
      </div>
    </Stack>
  );
};
