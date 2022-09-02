import React, { FormEvent, useCallback, useEffect, useState, useRef } from 'react';
import { ClickOutsideWrapper, Icon, Input, Spinner } from '@grafana/ui';
import { MetricPickerMenu } from './MetricPickerMenu';
import { SelectableValue } from '@grafana/data';

export interface Props {
  value: string;
  isLoading?: boolean;
  options: SelectableValue<string>[];
  onChange: (value: string) => void;
}

export const MetricPicker = ({ value, options, isLoading, onChange }: Props): JSX.Element => {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [offset, setOffset] = useState({ vertical: 0, horizontal: 0 });
  const ref = useRef<HTMLDivElement>(null);

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
          value={query}
          type="text"
          onChange={onInputChange}
          onBlur={() => onChange(query)}
          onMouseDown={onOpen}
          suffix={isLoading && <Spinner />}
        />
        {isOpen && <MetricPickerMenu options={options} onSelect={onMenuOptionSelect} offset={offset} />}
      </ClickOutsideWrapper>
    </div>
  );
};
