import { Tooltip, Button, Combobox, ComboboxOption, Stack, Input } from '@grafana/ui';
import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { HostTagOperatorLabel, HostTagOperatorValue } from './types';
import { HostTagFilter } from 'datasource/types/query';

const OPERATOR_OPTIONS: ComboboxOption[] = [
  { value: HostTagOperatorValue.Exists, label: HostTagOperatorLabel.Exists },
  { value: HostTagOperatorValue.Equals, label: HostTagOperatorLabel.Equals },
  { value: HostTagOperatorValue.Contains, label: HostTagOperatorLabel.Contains },
  { value: HostTagOperatorValue.DoesNotExist, label: HostTagOperatorLabel.DoesNotExist },
  { value: HostTagOperatorValue.DoesNotEqual, label: HostTagOperatorLabel.DoesNotEqual },
  { value: HostTagOperatorValue.DoesNotContain, label: HostTagOperatorLabel.DoesNotContain },
];

interface Props {
  hostTagOptions: ComboboxOption[];
  hostTagOptionsLoading: boolean;
  onHostTagFilterChange?: (hostTags: HostTagFilter[]) => void;
}
export const HostTagQueryEditor = ({ hostTagOptions, hostTagOptionsLoading, onHostTagFilterChange }: Props) => {
  const [hostTagFilters, setHostTagFilters] = useState<HostTagFilter[]>([]);

  const onAddHostTagFilter = useCallback(() => {
    setHostTagFilters((prevFilters) => [
      ...prevFilters,
      { tag: '', value: '', operator: HostTagOperatorValue.Contains },
    ]);
  }, []);

  const onRemoveHostTagFilter = useCallback((index: number) => {
    setHostTagFilters((prevFilters) => prevFilters.filter((_, i) => i !== index));
  }, []);

  const setHostTagFilterName = useCallback((index: number, name: string) => {
    setHostTagFilters((prevFilters) =>
      prevFilters.map((filter, i) => (i === index ? { ...filter, tag: name } : filter))
    );
  }, []);

  const setHostTagFilterValue = useCallback((index: number, value: string) => {
    if (value !== undefined) {
      setHostTagFilters((prevFilters) =>
        prevFilters.map((filter, i) => (i === index ? { ...filter, hostTagValue: value } : filter))
      );
    }
  }, []);

  const setHostTagFilterOperator = useCallback((index: number, operator: HostTagOperatorValue) => {
    setHostTagFilters((prevFilters) =>
      prevFilters.map((filter, i) => (i === index ? { ...filter, operator } : filter))
    );
  }, []);

  useEffect(() => {
    onHostTagFilterChange(hostTagFilters);
  }, [hostTagFilters]);
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
                value={filter.tag}
                onChange={(option: ComboboxOption) => setHostTagFilterName(index, option.value)}
                options={hostTagOptions ?? []}
                width={19}
                loading={hostTagOptionsLoading}
              />
              <Combobox
                value={filter.operator}
                onChange={(option: ComboboxOption<HostTagOperatorValue>) =>
                  setHostTagFilterOperator(index, option.value)
                }
                options={OPERATOR_OPTIONS}
                width={19}
              />
              {filter.operator !== HostTagOperatorValue.Exists &&
                filter.operator !== HostTagOperatorValue.DoesNotExist && (
                  <Input
                    value={filter.value}
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
