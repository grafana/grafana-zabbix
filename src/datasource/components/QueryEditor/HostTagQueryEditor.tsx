import { Tooltip, Button, Combobox, ComboboxOption, Stack, Input } from '@grafana/ui';
import React, { FormEvent, useCallback, useState } from 'react';

interface HostTagFilter {
  hostTagName: string;
  hostTagValue: string;
  operator: string;
}

const OPERATOR_OPTIONS: ComboboxOption[] = [
  { value: 'Exists', label: 'Exists' },
  { value: 'Equals', label: 'Equals' },
  { value: 'Contains', label: 'Contains' },
  { value: 'Does not exist', label: 'Does not exist' },
  { value: 'Does not equal', label: 'Does not equal' },
  { value: 'Does not contain', label: 'Does not contain' },
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
              />
              <Combobox
                value={filter.operator}
                onChange={(option: ComboboxOption) => setHostTagFilterOperator(index, option.value)}
                options={OPERATOR_OPTIONS}
              />
              <Input
                value={filter.hostTagValue}
                onChange={(evt: FormEvent<HTMLInputElement>) => setHostTagFilterValue(index, evt?.currentTarget?.value)}
              />
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
