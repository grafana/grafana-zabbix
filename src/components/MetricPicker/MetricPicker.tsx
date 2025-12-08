import { css } from '@emotion/css';
import React, { useRef } from 'react';
import { Combobox, ComboboxOption } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';

export interface Props {
  value: string;
  isLoading?: boolean;
  options: Array<ComboboxOption<string>>;
  width?: number;
  onChange: (value: string) => void;
}

export const MetricPicker = ({ value, options, isLoading, width, onChange }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  const onMenuOptionSelect = (option: SelectableValue<string>) => {
    const newValue = option?.value || '';
    onChange(newValue);
  };

  console.log(options);
  return (
    <div data-testid="role-picker" style={{ position: 'relative' }} ref={ref}>
      <Combobox<string>
        width={width}
        value={value}
        options={options ?? []}
        onChange={onMenuOptionSelect}
        loading={isLoading}
      />
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    inputRegexp: css`
      input {
        color: ${theme.colors.warning.main};
      }
    `,
    inputVariable: css`
      input {
        color: ${theme.colors.primary.text};
      }
    `,
  };
};
