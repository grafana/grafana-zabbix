import React, { FormEvent } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import {
  Alert,
  ColorPicker,
  Icon,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  InlineSwitch,
  Input,
  Tooltip,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui';
import { ProblemsPanelOptions, TriggerSeverity } from '../types';
import { AppliedSeverityOverride, ProblemsPanelInstanceState } from '../severityOverrides';

type Props = StandardEditorProps<TriggerSeverity[], any, ProblemsPanelOptions, ProblemsPanelInstanceState>;

export const ProblemColorEditor = ({ value, onChange, context }: Props) => {
  const globalOverrides = context?.instanceState?.globalSeverityOverrides;
  const hasGlobalOverrides = !!globalOverrides && globalOverrides.applied.length > 0;

  const onSeverityItemChange = (severity: TriggerSeverity) => {
    onChange(value.map((v) => (v.priority === severity.priority ? severity : v)));
  };

  return (
    <>
      {hasGlobalOverrides && (
        <Alert severity="info" title="Global severity overrides apply to this panel">
          The data source {formatDatasourceNames(globalOverrides.datasourceNames)} defines global severity names and/or
          colors. Rows marked with <Icon name="globe" size="sm" /> below display the global value because they still use
          the plugin default here. Set a custom name or color in this panel to override the global value for this panel
          only.
        </Alert>
      )}
      {value.map((severity, index) => (
        <ProblemColorEditorRow
          key={`${severity.priority}-${index}`}
          value={severity}
          globalOverride={globalOverrides?.applied.find((o) => o.priority === severity.priority)}
          onChange={(value) => onSeverityItemChange(value)}
        />
      ))}
    </>
  );
};

const formatDatasourceNames = (names: string[]) => {
  if (!names?.length) {
    return '';
  }
  return names.map((n) => `"${n}"`).join(', ');
};

interface ProblemColorEditorRowProps {
  value: TriggerSeverity;
  /** Global values from the data source that are in effect for this severity */
  globalOverride?: AppliedSeverityOverride;
  onChange: (value?: TriggerSeverity) => void;
}

export const ProblemColorEditorRow = ({ value, globalOverride, onChange }: ProblemColorEditorRowProps) => {
  const styles = useStyles2(getStyles);

  const onSeverityNameChange = (v: FormEvent<HTMLInputElement>) => {
    const newValue = v?.currentTarget?.value;
    if (newValue !== null && newValue !== value.severity) {
      onChange({ ...value, severity: newValue });
    }
  };

  const hasGlobalOverride =
    !!globalOverride && (globalOverride.name !== undefined || globalOverride.color !== undefined);

  return (
    <VerticalGroup>
      <InlineFieldRow>
        <InlineField labelWidth={12}>
          <Input width={24} defaultValue={value.severity} onBlur={onSeverityNameChange} />
        </InlineField>
        <InlineLabel width={4}>
          <ColorPicker color={value.color} onChange={(color) => onChange({ ...value, color })} />
        </InlineLabel>
        <InlineField label="Show">
          <InlineSwitch value={value.show} onChange={() => onChange({ ...value, show: !value.show })} />
        </InlineField>
        {hasGlobalOverride && (
          <Tooltip content={<GlobalOverrideTooltip override={globalOverride} />}>
            <InlineLabel
              className={styles.globalLabel}
              aria-label={`Global override in effect for severity ${value.priority}`}
              data-testid={`severity-global-override-${value.priority}`}
            >
              <Icon name="globe" size="sm" />
              {globalOverride.name !== undefined && <span className={styles.globalName}>{globalOverride.name}</span>}
              {globalOverride.color !== undefined && (
                <span className={styles.swatch} style={{ backgroundColor: globalOverride.color }} />
              )}
            </InlineLabel>
          </Tooltip>
        )}
      </InlineFieldRow>
    </VerticalGroup>
  );
};

const GlobalOverrideTooltip = ({ override }: { override: AppliedSeverityOverride }) => (
  <div>
    <div>Displayed value comes from the data source global overrides:</div>
    {override.name !== undefined && <div>Name: {override.name}</div>}
    {override.color !== undefined && <div>Color: {override.color}</div>}
    <div>Set a custom name or color here to override it for this panel.</div>
  </div>
);

const getStyles = (theme: GrafanaTheme2) => ({
  globalLabel: css({
    flexGrow: 0,
    width: 'auto',
    gap: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    cursor: 'help',
  }),
  globalName: css({
    maxWidth: 140,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  swatch: css({
    display: 'inline-block',
    width: 14,
    height: 14,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
});
