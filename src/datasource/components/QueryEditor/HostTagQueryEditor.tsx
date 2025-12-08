import { Tooltip, Button, Combobox, ComboboxOption, Stack, Input } from '@grafana/ui';
import React, { FormEvent, useCallback, useState } from 'react';
import { HostTagOperators } from './types';

interface HostTagFilter {
  hostTagName: string;
  operator: string;
  hostTagValue?: string;
}

const OPERATOR_OPTIONS: ComboboxOption[] = [
  { value: HostTagOperators.Exists, label: HostTagOperators.Exists },
  { value: HostTagOperators.Equals, label: HostTagOperators.Equals },
  { value: HostTagOperators.Contains, label: HostTagOperators.Contains },
  { value: HostTagOperators.DoesNotExist, label: HostTagOperators.DoesNotExist },
  { value: HostTagOperators.DoesNotEqual, label: HostTagOperators.DoesNotEqual },
  { value: HostTagOperators.DoesNotContain, label: HostTagOperators.DoesNotContain },
];

export const HostTagQueryEditor = () => {
  const [hostTagFilters, setHostTagFilters] = useState<HostTagFilter[]>([]);

  const onAddHostTagFilter = useCallback(() => {
    setHostTagFilters((prevFilters) => [...prevFilters, { hostTagName: '', hostTagValue: '', operator: 'Contains' }]);
  }, []);

  const onRemoveHostTagFilter = useCallback((index: number) => {
    setHostTagFilters((prevFilters) => prevFilters.filter((_, i) => i !== index));
  }, []);

  const setHostTagFilterName = useCallback((index: number, name: string) => {
    setHostTagFilters((prevFilters) =>
      prevFilters.map((filter, i) => (i === index ? { ...filter, hostTagName: name } : filter))
    );
  }, []);

  const setHostTagFilterValue = useCallback((index: number, value: string) => {
    if (value !== undefined) {
      setHostTagFilters((prevFilters) =>
        prevFilters.map((filter, i) => (i === index ? { ...filter, hostTagValue: value } : filter))
      );
    }
  }, []);

  const setHostTagFilterOperator = useCallback((index: number, operator: string) => {
    setHostTagFilters((prevFilters) =>
      prevFilters.map((filter, i) => (i === index ? { ...filter, operator } : filter))
    );
  }, []);

  return (
    <div>
      <Tooltip content="Add host tag filter">
        <Button icon="plus" variant="secondary" aria-label="Add new host tag filter" onClick={onAddHostTagFilter} />
      </Tooltip>
      <Stack direction="column">
        {hostTagFilters.map((filter, index) => {
          return (
            <Stack key={`host-tag-filter-${index}`} direction="row">
              <Combobox
                value={filter.hostTagName}
                onChange={(option: ComboboxOption) => setHostTagFilterName(index, option.value)}
                options={[]}
                width={19}
              />
              <Combobox
                value={filter.operator}
                onChange={(option: ComboboxOption) => setHostTagFilterOperator(index, option.value)}
                options={OPERATOR_OPTIONS}
                width={19}
              />
              {filter.operator !== HostTagOperators.Exists && filter.operator !== HostTagOperators.DoesNotExist && (
                <Input
                  value={filter.hostTagValue}
                  onChange={(evt: FormEvent<HTMLInputElement>) =>
                    setHostTagFilterValue(index, evt?.currentTarget?.value)
                  }
                  width={19}
                />
              )}
              <Tooltip content="Remove host tag filter">
                <Button
                  key={`remove-host-tag-${index}`}
                  icon="minus"
                  variant="secondary"
                  aria-label="Remove host tag filter"
                  onClick={() => onRemoveHostTagFilter(index)}
                />
              </Tooltip>
            </Stack>
          );
        })}
      </Stack>
    </div>
  );
};
