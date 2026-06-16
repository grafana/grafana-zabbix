import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { uniqBy } from 'lodash';
import { Button, Checkbox, InlineField, InlineFieldRow, Input, RadioButtonGroup, Select, Stack, Icon, ComboboxOption } from '@grafana/ui';
import { ZabbixMetricsQuery, MetricColumnConfig, HostTagFilter, ZabbixTagEvalType } from '../../types/query';
import { ZabbixDatasource } from '../../datasource';
import { MetricPicker } from '../../../components/MetricPicker/MetricPicker';
import { HostTagQueryEditor } from './HostTagQueryEditor';
import { getVariableOptions, processHostTags } from './utils';
import { useInterpolatedQuery } from '../../hooks/useInterpolatedQuery';
import { ZBXItem } from '../../types';

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

  // Local state for the extract pattern (regex) — committed on blur to avoid invalid intermediate values.
  const [localExtractPattern, setLocalExtractPattern] = useState(tableConfig.entityPattern.extractPattern || '');

  // Local state for the metric column name — committed on blur.
  const [localMetricNames, setLocalMetricNames] = useState(tableConfig.metrics.map((m) => m.columnName));

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

  // Fetch items (raw list) once per group/host change; we derive name/key option arrays in-memo below.
  const [{ loading: itemsLoading, value: items }, fetchItems] = useAsyncFn(async () => {
    const fetched: ZBXItem[] = await datasource.zabbix.getAllItems(
      interpolatedQuery.group.filter,
      interpolatedQuery.host.filter,
      null,
      null,
      { itemtype: 'num' }
    );
    return fetched || [];
  }, [interpolatedQuery.group.filter, interpolatedQuery.host.filter]);

  const itemNameOptions = useMemo<Array<ComboboxOption<string>>>(() => {
    const opts: Array<ComboboxOption<string>> = (items ?? []).map((item) => ({
      value: item.name,
      label: item.name,
    }));
    const unique = uniqBy(opts, (o) => o.value);
    unique.unshift(...getVariableOptions());
    return unique;
  }, [items]);

  const itemKeyOptions = useMemo<Array<ComboboxOption<string>>>(() => {
    const opts: Array<ComboboxOption<string>> = (items ?? []).map((item) => ({
      value: item.key_,
      label: item.key_,
    }));
    const unique = uniqBy(opts, (o) => o.value);
    unique.unshift(...getVariableOptions());
    return unique;
  }, [items]);

  const optionsForSearchType = (searchType: 'itemName' | 'itemKey') =>
    searchType === 'itemKey' ? itemKeyOptions : itemNameOptions;

  // Sync deferred local state when the query changes externally (e.g., variable resolution, panel switch).
  useEffect(() => {
    setLocalExtractPattern(tableConfig.entityPattern.extractPattern || '');
  }, [tableConfig.entityPattern.extractPattern]);

  useEffect(() => {
    setLocalMetricNames(tableConfig.metrics.map((m) => m.columnName));
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

  useEffect(() => {
    fetchItems();
  }, [interpolatedQuery.group.filter, interpolatedQuery.host.filter]);

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

  const onEntityPatternChange = (value: string) => {
    onChange({
      ...safeQuery,
      tableConfig: {
        ...tableConfig,
        entityPattern: {
          ...tableConfig.entityPattern,
          pattern: value || '',
        },
      },
    });
  };

  const onExtractPatternBlur = () => {
    if (localExtractPattern !== (tableConfig.entityPattern.extractPattern || '')) {
      onChange({
        ...safeQuery,
        tableConfig: {
          ...tableConfig,
          entityPattern: {
            ...tableConfig.entityPattern,
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

  const commitMetric = (index: number, patch: Partial<MetricColumnConfig>) => {
    const newMetrics = [...tableConfig.metrics];
    newMetrics[index] = { ...newMetrics[index], ...patch };
    onChange({
      ...safeQuery,
      tableConfig: {
        ...tableConfig,
        metrics: newMetrics,
      },
    });
  };

  const onMetricColumnNameBlur = (index: number) => {
    const local = localMetricNames[index];
    if (local !== undefined && local !== tableConfig.metrics[index]?.columnName) {
      commitMetric(index, { columnName: local });
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

    setLocalMetricNames([...localMetricNames, newMetric.columnName]);
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

    setLocalMetricNames(localMetricNames.filter((_, i) => i !== index));
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
              <MetricPicker
                width={40}
                value={tableConfig.entityPattern.pattern}
                options={optionsForSearchType(tableConfig.entityPattern.searchType)}
                isLoading={itemsLoading}
                placeholder="e.g., /Interface.*/ or /.*: Disk .*/ or /FS .*: .*/"
                createCustomValue={true}
                onChange={onEntityPatternChange}
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
                onBlur={onExtractPatternBlur}
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
                  value={localMetricNames[index] ?? metric.columnName}
                  placeholder="Column name"
                  onChange={(e) => {
                    const next = [...localMetricNames];
                    next[index] = e.currentTarget.value;
                    setLocalMetricNames(next);
                  }}
                  onBlur={() => onMetricColumnNameBlur(index)}
                />
              </InlineField>
              <InlineField label="Search by" labelWidth={16}>
                <RadioButtonGroup
                  value={metric.searchType}
                  options={searchTypeOptions}
                  onChange={(value) => commitMetric(index, { searchType: value as 'itemName' | 'itemKey' })}
                />
              </InlineField>
              <InlineField label="Pattern" labelWidth={16} grow>
                <MetricPicker
                  width={40}
                  value={metric.pattern}
                  options={optionsForSearchType(metric.searchType)}
                  isLoading={itemsLoading}
                  placeholder="e.g., /.*Status/"
                  createCustomValue={true}
                  onChange={(value) => commitMetric(index, { pattern: value || '' })}
                />
              </InlineField>
              <InlineField
                label="Aggregation"
                labelWidth={16}
                disabled={metric.showSparkline}
                tooltip={
                  metric.showSparkline ? 'Not used for sparkline columns — the full series is returned.' : undefined
                }
              >
                <Select
                  width={15}
                  value={metric.aggregation}
                  options={aggregationOptions}
                  disabled={metric.showSparkline}
                  onChange={(option) => commitMetric(index, { aggregation: option.value as MetricColumnConfig['aggregation'] })}
                />
              </InlineField>
              <InlineField
                label="Sparkline"
                labelWidth={12}
                tooltip="Return this column as its own time-series frame (full history over the panel time range) instead of a scalar value. Render it as a sparkline by adding Grafana's 'Time series to table' transformation; one Trend column is produced per sparkline metric."
              >
                <Checkbox
                  value={metric.showSparkline || false}
                  onChange={(e) => commitMetric(index, { showSparkline: e.currentTarget.checked })}
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
        <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
          <strong>Sparkline:</strong> Each enabled column is returned as its own time-series frame (full history)
          instead of a scalar. Add the Grafana <em>Time series to table</em> transformation to get one Trend column per
          metric, then <em>Join by field</em> / <em>Merge</em> on the Host/Entity (or extracted) columns. The first
          (table) frame carries the row dimensions and is the join base.
        </p>
      </div>
    </Stack>
  );
};
