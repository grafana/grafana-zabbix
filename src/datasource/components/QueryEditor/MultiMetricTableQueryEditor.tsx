import React, { useEffect, useState } from 'react';
import { Button, Checkbox, InlineField, InlineFieldRow, Input, RadioButtonGroup, Select, Stack } from '@grafana/ui';
import { ComboboxOption } from '@grafana/ui';
import { ZabbixMetricsQuery, MetricColumnConfig } from '../../types/query';
import { ZabbixDatasource } from '../../datasource';
import { MetricPicker } from '../../../components/MetricPicker/MetricPicker';

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
  const [groups, setGroups] = useState<ComboboxOption<string>[]>([]);
  const [hosts, setHosts] = useState<ComboboxOption<string>[]>([]);

  // Ensure defaults
  const safeQuery: ZabbixMetricsQuery = {
    ...query,
    group: query.group || { filter: '' },
    host: query.host || { filter: '' },
    application: query.application || { filter: '' },
    itemTag: query.itemTag || { filter: '' },
    tableConfig: query.tableConfig || {
      entityPattern: { searchType: 'itemName', pattern: '', extractNameRegex: '' },
      metrics: [],
      showGroupColumn: false,
      showHostColumn: false,
    },
  };

  const tableConfig = safeQuery.tableConfig!;

  // Local state for entity pattern (with onBlur)
  const [localEntityPattern, setLocalEntityPattern] = useState(tableConfig.entityPattern.pattern);
  const [localExtractRegex, setLocalExtractRegex] = useState(tableConfig.entityPattern.extractNameRegex || '');

  // Local state for metric fields (array of objects)
  const [localMetrics, setLocalMetrics] = useState(
    tableConfig.metrics.map((m) => ({ columnName: m.columnName, pattern: m.pattern }))
  );

  // Sync local state when query changes externally
  useEffect(() => {
    setLocalEntityPattern(tableConfig.entityPattern.pattern);
    setLocalExtractRegex(tableConfig.entityPattern.extractNameRegex || '');
  }, [tableConfig.entityPattern.pattern, tableConfig.entityPattern.extractNameRegex]);

  // Sync local metrics when query changes
  useEffect(() => {
    setLocalMetrics(tableConfig.metrics.map((m) => ({ columnName: m.columnName, pattern: m.pattern })));
  }, [tableConfig.metrics.length]); // Only sync when metrics array length changes

  // Load groups on mount
  useEffect(() => {
    datasource.zabbix
      .getGroups('/.*/')
      .then((groups) => {
        setGroups(groups.map((g) => ({ label: g.name, value: g.name })));
      })
  }, [datasource]);

  // Load hosts when group changes
  useEffect(() => {
    const groupFilter = safeQuery.group.filter;
    if (groupFilter && groupFilter.trim() !== '') {
      datasource.zabbix
        .getHosts(groupFilter, '/.*/')
        .then((hosts) => {
          setHosts(hosts.map((h) => ({ label: h.name, value: h.name })));
        })
    } else {
      setHosts([]);
    }
  }, [datasource, safeQuery.group.filter]);

  const onGroupChange = (value: string) => {
    onChange({
      ...safeQuery,
      group: { filter: value || '' },
      host: { filter: '' },
    });
  };

  const onHostChange = (value: string) => {
    onChange({
      ...safeQuery,
      host: { filter: value || '' },
    });
  };

  const onApplicationChange = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({
      ...safeQuery,
      application: { filter: e.currentTarget.value || '' },
    });
  };

  const onEntityPatternBlur = () => {
    // Only update if values changed
    if (
      localEntityPattern !== tableConfig.entityPattern.pattern ||
      localExtractRegex !== (tableConfig.entityPattern.extractNameRegex || '')
    ) {
      onChange({
        ...safeQuery,
        tableConfig: {
          ...tableConfig,
          entityPattern: {
            ...tableConfig.entityPattern,
            pattern: localEntityPattern,
            extractNameRegex: localExtractRegex,
          },
        },
      });
    }
  };

  const onMetricChange = (index: number, field: keyof MetricColumnConfig, value: any) => {
    const newMetrics = [...tableConfig.metrics];
    newMetrics[index] = { ...newMetrics[index], [field]: value };

    // Update local state for columnName and pattern
    if (field === 'columnName' || field === 'pattern') {
      const newLocalMetrics = [...localMetrics];
      if (!newLocalMetrics[index]) {
        newLocalMetrics[index] = { columnName: '', pattern: '' };
      }
      newLocalMetrics[index] = { ...newLocalMetrics[index], [field]: value };
      setLocalMetrics(newLocalMetrics);
    }

    // Only trigger onChange for non-text fields (searchType, aggregation)
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
    // Check if values changed
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

    // Add to local state
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

    // Remove from local state
    const newLocalMetrics = localMetrics.filter((_, i) => i !== index);
    setLocalMetrics(newLocalMetrics);
  };

  return (
    <Stack direction="column" gap={2}>
        {/* First row: Group and Host */}
        <InlineFieldRow>
        <InlineField label="Group" labelWidth={16} grow>
            <MetricPicker
            value={safeQuery.group.filter}
            placeholder="Select or type group filter"
            options={groups}
            createCustomValue={true}
            onChange={onGroupChange}
            />
        </InlineField>
        <InlineField label="Host" labelWidth={16} grow>
            <MetricPicker
            value={safeQuery.host.filter}
            placeholder="Select or type host filter"
            options={hosts}
            createCustomValue={true}
            onChange={onHostChange}
            />
        </InlineField>
        </InlineFieldRow>

        {/* Second row: Application and checkboxes */}
        <InlineFieldRow>
        <InlineField label="Application" labelWidth={16} grow tooltip="Optional: Application filter">
            <Input
            value={safeQuery.application.filter}
            placeholder="e.g., /.*/  (optional)"
            onChange={onApplicationChange}
            />
        </InlineField>
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
                        searchType: value as 'itemName' | 'itemKey' 
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
                placeholder="e.g., /Interface.*/ or *"
                onChange={(e) => setLocalEntityPattern(e.currentTarget.value)}
                onBlur={onEntityPatternBlur}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label="Extract label"
              labelWidth={16}
              grow
              tooltip="Optional: Regex to extract entity name, e.g., 'Interface (.*)'"
            >
              <Input
                value={localExtractRegex}
                placeholder="e.g., Interface (.*)"
                onChange={(e) => setLocalExtractRegex(e.currentTarget.value)}
                onBlur={onEntityPatternBlur}
              />
            </InlineField>
          </InlineFieldRow>
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
          <strong>How it works:</strong> Select Group/Host, define entity pattern for rows, then add metric columns.
        </p>
        <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
          <strong>Example:</strong> Host: "switch-01", Entity: "/Interface.*/" (Item Name), Extract: "Interface (.*)",
          Columns: "Status" pattern "/.*Status/", "In" pattern "/.*Bits received/".
        </p>
      </div>
    </Stack>
  );
};
