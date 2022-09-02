import { css, cx } from '@emotion/css';
import React, { FormEvent, useCallback, useEffect, useState, useRef } from 'react';
import { ClickOutsideWrapper, Icon, Input, Spinner, useStyles2 } from '@grafana/ui';
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
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(-1);
  const [offset, setOffset] = useState({ vertical: 0, horizontal: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const customStyles = useStyles2(getStyles);

  const inputClass = cx({
    [customStyles.inputRegexp]: isRegex(query),
    [customStyles.inputVariable]: query.startsWith('$'),
  });

  useEffect(() => {
    setFilteredOptions(options);
  }, [options]);

  const onOpen = () => {
    setOpen(true);
    setFilteredOptions(options);
  };

  const onClose = useCallback(() => {
    setOpen(false);
  }, []);

  // Only call onClose if menu is open. Prevent unnecessary calls for multiple pickers on the page.
  const onClickOutside = () => isOpen && onClose();

  const onInputChange = (v: FormEvent<HTMLInputElement>) => {
    if (!isOpen) {
      setOpen(true);
    }
    const newQuery = v?.currentTarget?.value;
    if (newQuery) {
      setQuery(newQuery);
      if (value != newQuery) {
        const filtered = options.filter(
          (option) =>
            option.value?.toLowerCase().includes(newQuery.toLowerCase()) ||
            option.label?.toLowerCase().includes(newQuery.toLowerCase())
        );
        setFilteredOptions(filtered);
      } else {
        setFilteredOptions(options);
      }
    } else {
      setQuery('');
      setFilteredOptions(options);
    }
  };

  const onMenuOptionSelect = (option: SelectableValue<string>) => {
    const newValue = option.value || '';
    setQuery(newValue);
    onChange(newValue);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      if (!isOpen) {
        setOpen(true);
      }
      e.preventDefault();
      e.stopPropagation();
      const selected = selectedOptionIdx < filteredOptions.length - 1 ? selectedOptionIdx + 1 : 0;
      setSelectedOptionIdx(selected);
    } else if (e.key === 'ArrowUp') {
      if (!isOpen) {
        setOpen(true);
      }
      e.preventDefault();
      e.stopPropagation();
      const selected = selectedOptionIdx > 0 ? selectedOptionIdx - 1 : filteredOptions.length - 1;
      setSelectedOptionIdx(selected);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onMenuOptionSelect(filteredOptions[selectedOptionIdx]);
    }
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
          onKeyDown={onKeyDown}
        />
        {isOpen && (
          <MetricPickerMenu
            options={filteredOptions}
            onSelect={onMenuOptionSelect}
            offset={offset}
            minWidth={width}
            selected={selectedOptionIdx}
          />
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
