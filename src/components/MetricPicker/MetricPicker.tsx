import { css, cx } from '@emotion/css';
import React, { FormEvent, useCallback, useEffect, useState, useRef } from 'react';
import { ClickOutsideWrapper, Icon, Input, Spinner, useStyles2, useTheme2 } from '@grafana/ui';
import { MetricPickerMenu } from './MetricPickerMenu';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { isRegex } from '../../datasource-zabbix/utils';

export interface Props {
  value: string;
  isLoading?: boolean;
  options: SelectableValue<string>[];
  width?: number;
  onChange: (value: string) => void;
}

export const MetricPicker = ({ value, options, isLoading, width, onChange }: Props): JSX.Element => {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [offset, setOffset] = useState({ vertical: 0, horizontal: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const customStyles = useStyles2(getStyles);

  const inputClass = cx({
    [customStyles.inputRegexp]: isRegex(query),
    [customStyles.inputVariable]: query.startsWith('$'),
  });

  const onOpen = useCallback(
    (event: FormEvent<HTMLElement>) => {
      // event.preventDefault();
      // event.stopPropagation();
      setOpen(true);
    },
    [setOpen]
  );

  const onClose = useCallback(() => {
    setOpen(false);
    // setQuery('');
  }, []);

  // Only call onClose if menu is open. Prevent unnecessary calls for multiple pickers on the page.
  const onClickOutside = () => isOpen && onClose();

  const onInputChange = (v: FormEvent<HTMLInputElement>) => {
    if (v?.currentTarget?.value) {
      setQuery(v?.currentTarget?.value);
    } else {
      setQuery('');
    }
  };

  const onMenuOptionSelect = (option: SelectableValue<string>) => {
    const newValue = option.value || '';
    setQuery(newValue);
    onChange(newValue);
    onClose();
  };

  return (
    <div data-testid="role-picker" style={{ position: 'relative' }} ref={ref}>
      <ClickOutsideWrapper onClick={onClickOutside}>
        <Input
          className={inputClass}
          value={query}
          type="text"
          onChange={onInputChange}
          onBlur={() => onChange(query)}
          onMouseDown={onOpen}
          suffix={isLoading && <Spinner />}
          width={width}
        />
        {isOpen && (
          <MetricPickerMenu options={options} onSelect={onMenuOptionSelect} offset={offset} minWidth={width} />
        )}
      </ClickOutsideWrapper>
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
