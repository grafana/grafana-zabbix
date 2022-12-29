import { css } from '@emotion/css';
import React, { useState, FormEvent } from 'react';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  HorizontalGroup,
  Icon,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  Input,
  Select,
  useStyles2,
} from '@grafana/ui';
import * as c from '../../constants';
import { ZabbixQueryOptions } from '../../types';

const ackOptions: Array<SelectableValue<number>> = [
  { label: 'all triggers', value: 2 },
  { label: 'unacknowledged', value: 0 },
  { label: 'acknowledged', value: 1 },
];

const sortOptions: Array<SelectableValue<string>> = [
  { label: 'Default', value: 'default' },
  { label: 'Last change', value: 'lastchange' },
  { label: 'Severity', value: 'severity' },
];

const trendsOptions: Array<SelectableValue<string>> = [
  { label: 'Default', value: 'default' },
  { label: 'True', value: 'true' },
  { label: 'False', value: 'false' },
];

interface Props {
  queryType: string;
  queryOptions: ZabbixQueryOptions;
  onChange: (options: ZabbixQueryOptions) => void;
}

export const QueryOptionsEditor = ({ queryType, queryOptions, onChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);

  const onLimitChange = (v: FormEvent<HTMLInputElement>) => {
    const newValue = Number(v?.currentTarget?.value);
    if (newValue !== null) {
      onChange({ ...queryOptions, limit: newValue });
    }
  };

  const onPropChange = (prop: string) => {
    return (option: SelectableValue) => {
      if (option.value !== null) {
        onChange({ ...queryOptions, [prop]: option.value });
      }
    };
  };

  const renderClosed = () => {
    return (
      <>
        <HorizontalGroup>
          {!isOpen && <Icon name="angle-right" />}
          {isOpen && <Icon name="angle-down" />}
          <span className={styles.label}>Options</span>
          <div className={styles.options}>{renderOptions()}</div>
        </HorizontalGroup>
      </>
    );
  };

  const renderOptions = () => {
    const elements: JSX.Element[] = [];
    for (const key in queryOptions) {
      if (queryOptions.hasOwnProperty(key)) {
        const value = queryOptions[key];
        if (value === true && value !== '' && value !== null && value !== undefined) {
          elements.push(<span className={styles.optionContainer} key={key}>{`${key} = ${value}`}</span>);
        }
      }
    }
    return elements;
  };

  const renderEditor = () => {
    return (
      <div className={styles.editorContainer}>
        {queryType === c.MODE_METRICS && renderMetricOptions()}
        {queryType === c.MODE_ITEMID && renderMetricOptions()}
        {queryType === c.MODE_ITSERVICE && renderMetricOptions()}
        {queryType === c.MODE_TEXT && renderTextMetricsOptions()}
        {queryType === c.MODE_PROBLEMS && renderProblemsOptions()}
        {queryType === c.MODE_TRIGGERS && renderTriggersOptions()}
      </div>
    );
  };

  const renderMetricOptions = () => {
    return (
      <>
        <InlineField label="Trends" labelWidth={24}>
          <Select
            isSearchable={false}
            width={16}
            value={queryOptions.useTrends}
            options={trendsOptions}
            onChange={onPropChange('useTrends')}
          />
        </InlineField>
        <InlineField label="Show disabled items" labelWidth={24}>
          <InlineSwitch
            value={queryOptions.showDisabledItems}
            onChange={() => onChange({ ...queryOptions, showDisabledItems: !queryOptions.showDisabledItems })}
          />
        </InlineField>
        <InlineField label="Use Zabbix value mapping" labelWidth={24}>
          <InlineSwitch
            value={queryOptions.useZabbixValueMapping}
            onChange={() => onChange({ ...queryOptions, useZabbixValueMapping: !queryOptions.useZabbixValueMapping })}
          />
        </InlineField>
        <InlineField label="Disable data alignment" labelWidth={24}>
          <InlineSwitch
            value={queryOptions.disableDataAlignment}
            onChange={() => onChange({ ...queryOptions, disableDataAlignment: !queryOptions.disableDataAlignment })}
          />
        </InlineField>
      </>
    );
  };

  const renderTextMetricsOptions = () => {
    return (
      <>
        <InlineField label="Show disabled items" labelWidth={24}>
          <InlineSwitch
            value={queryOptions.showDisabledItems}
            onChange={() => onChange({ ...queryOptions, showDisabledItems: !queryOptions.showDisabledItems })}
          />
        </InlineField>
      </>
    );
  };

  const renderProblemsOptions = () => {
    return (
      <>
        <InlineField label="Acknowledged" labelWidth={24}>
          <Select
            isSearchable={false}
            width={24}
            value={queryOptions.acknowledged}
            options={ackOptions}
            onChange={onPropChange('acknowledged')}
          />
        </InlineField>
        <InlineField label="Sort by" labelWidth={24}>
          <Select
            isSearchable={false}
            width={24}
            value={queryOptions.sortProblems}
            options={sortOptions}
            onChange={onPropChange('sortProblems')}
          />
        </InlineField>
        <InlineField label="Use time range" labelWidth={24}>
          <InlineSwitch
            value={queryOptions.useTimeRange}
            onChange={() => onChange({ ...queryOptions, useTimeRange: !queryOptions.useTimeRange })}
          />
        </InlineField>
        <InlineField label="Hosts in maintenance" labelWidth={24}>
          <InlineSwitch
            value={queryOptions.hostsInMaintenance}
            onChange={() => onChange({ ...queryOptions, hostsInMaintenance: !queryOptions.hostsInMaintenance })}
          />
        </InlineField>
        <InlineField label="Host proxy" labelWidth={24}>
          <InlineSwitch
            value={queryOptions.hostProxy}
            onChange={() => onChange({ ...queryOptions, hostProxy: !queryOptions.hostProxy })}
          />
        </InlineField>
        <InlineField label="Limit" labelWidth={24}>
          <Input width={12} type="number" defaultValue={queryOptions.limit} onBlur={onLimitChange} />
        </InlineField>
      </>
    );
  };

  const renderTriggersOptions = () => {
    return (
      <>
        <InlineField label="Acknowledged" labelWidth={24}>
          <Select
            isSearchable={false}
            width={24}
            value={queryOptions.acknowledged}
            options={ackOptions}
            onChange={onPropChange('acknowledged')}
          />
        </InlineField>
      </>
    );
  };

  return (
    <>
      <InlineFieldRow>
        <div className={styles.container} onClick={() => setIsOpen(!isOpen)}>
          {renderClosed()}
        </div>
      </InlineFieldRow>
      <InlineFieldRow>{isOpen && renderEditor()}</InlineFieldRow>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.borderRadius(),
    marginRight: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)}`,
    height: `${theme.v1.spacing.formInputHeight}px`,
    width: `100%`,
  }),
  label: css({
    color: theme.colors.info.text,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
  }),
  options: css({
    color: theme.colors.text.disabled,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  optionContainer: css`
    margin-right: ${theme.spacing(2)};
  `,
  editorContainer: css`
    display: flex;
    flex-direction: column;
    margin-left: ${theme.spacing(4)};
  `,
});
