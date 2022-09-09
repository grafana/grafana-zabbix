import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import {
  HorizontalGroup,
  Icon,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui';
import { ZabbixQueryOptions } from '../types';

interface Props {
  queryOptions: ZabbixQueryOptions;
  onChange: (options: ZabbixQueryOptions) => void;
}

export const QueryOptionsEditor = ({ queryOptions, onChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);

  const renderClosed = () => {
    return (
      <>
        <HorizontalGroup>
          <Icon name="angle-right" />
          <span className={styles.label}>Options</span>
          <div className={styles.options}>{renderOptions()}</div>
        </HorizontalGroup>
      </>
    );
  };

  const renderOpened = () => {
    return (
      <>
        <HorizontalGroup>
          <Icon name="angle-down" />
          <span className={styles.label}>Options</span>
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
    return <div className={styles.editorContainer}>{renderMetricOptions()}</div>;
  };

  const renderMetricOptions = () => {
    return (
      <>
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
