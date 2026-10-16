import { Tooltip, Button, Combobox, ComboboxOption, Stack, RadioButtonGroup } from '@grafana/ui';
import React, { useCallback } from 'react';
import { HostTagOperatorLabel, HostTagOperatorValue } from './types';
import { HostTagFilter, ZabbixTagEvalType } from 'datasource/types/query';
import { getHostTagOptionLabel } from './utils';

interface Props {
  hostTagOptions: ComboboxOption[];
  hostTagOptionsLoading: boolean;
  version: string;
  /** The filters to render. This is a controlled component — the parent owns the filter list. */
  value?: HostTagFilter[];
  evalTypeValue?: ZabbixTagEvalType;
  hostTagValueOptions?: Record<string, ComboboxOption[]>;
  onHostTagFilterChange?: (hostTags: HostTagFilter[]) => void;
  onHostTagEvalTypeChange?: (evalType: ZabbixTagEvalType) => void;
}

export const HostTagQueryEditor = ({
  hostTagOptions,
  hostTagOptionsLoading,
  version,
  value,
  evalTypeValue,
  hostTagValueOptions,
  onHostTagFilterChange,
  onHostTagEvalTypeChange,
}: Props) => {
  // Rendered straight from props rather than mirrored into local state, so saved filters show up on
  // reopen and any later external change (query swapped, variable duplicated) is picked up too.
  const hostTagFilters = value ?? [];
  const operatorOptions: ComboboxOption[] = [
    { value: HostTagOperatorValue.Exists, label: HostTagOperatorLabel.Exists },
    { value: HostTagOperatorValue.Equals, label: HostTagOperatorLabel.Equals },
    { value: HostTagOperatorValue.Contains, label: HostTagOperatorLabel.Contains },
    {
      value: HostTagOperatorValue.DoesNotExist,
      label: getHostTagOptionLabel(HostTagOperatorValue.DoesNotExist, version),
    },
    {
      value: HostTagOperatorValue.DoesNotEqual,
      label: getHostTagOptionLabel(HostTagOperatorValue.DoesNotEqual, version),
    },
    {
      value: HostTagOperatorValue.DoesNotContain,
      label: getHostTagOptionLabel(HostTagOperatorValue.DoesNotContain, version),
    },
  ];

  // Emitted from the change handlers rather than an effect on state: an effect would also fire on
  // mount and write an empty filter list back into the query before the user touched anything.
  const applyHostTagFilters = onHostTagFilterChange ?? (() => {});

  const onAddHostTagFilter = useCallback(() => {
    applyHostTagFilters([...hostTagFilters, { tag: '', value: '', operator: HostTagOperatorValue.Contains }]);
  }, [applyHostTagFilters, hostTagFilters]);

  const onRemoveHostTagFilter = useCallback(
    (index: number) => {
      applyHostTagFilters(hostTagFilters.filter((_, i) => i !== index));
    },
    [applyHostTagFilters, hostTagFilters]
  );

  const setHostTagFilterName = useCallback(
    (index: number, name: string) => {
      applyHostTagFilters(hostTagFilters.map((filter, i) => (i === index ? { ...filter, tag: name } : filter)));
    },
    [applyHostTagFilters, hostTagFilters]
  );

  const setHostTagFilterValue = useCallback(
    (index: number, value: string) => {
      applyHostTagFilters(hostTagFilters.map((filter, i) => (i === index ? { ...filter, value } : filter)));
    },
    [applyHostTagFilters, hostTagFilters]
  );

  const setHostTagFilterOperator = useCallback(
    (index: number, operator: HostTagOperatorValue) => {
      applyHostTagFilters(hostTagFilters.map((filter, i) => (i === index ? { ...filter, operator } : filter)));
    },
    [applyHostTagFilters, hostTagFilters]
  );

  return (
    <div>
      <Stack direction="row">
        <Tooltip content="Add host tag filter">
          <Button icon="plus" variant="secondary" aria-label="Add new host tag filter" onClick={onAddHostTagFilter} />
        </Tooltip>
        {hostTagFilters.length > 0 && (
          <RadioButtonGroup
            options={[
              { label: 'AND/OR', value: '0' }, // Default
              { label: 'OR', value: '2' },
            ]}
            onChange={onHostTagEvalTypeChange}
            value={evalTypeValue ?? '0'}
          />
        )}
      </Stack>
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
                createCustomValue={true}
              />
              <Combobox
                value={filter.operator}
                onChange={(option: ComboboxOption<HostTagOperatorValue>) =>
                  setHostTagFilterOperator(index, option.value)
                }
                options={operatorOptions}
                width={19}
              />
              {filter.operator !== HostTagOperatorValue.Exists &&
                filter.operator !== HostTagOperatorValue.DoesNotExist && (
                  <Combobox
                    value={filter.value ?? ''}
                    onChange={(option: ComboboxOption) => setHostTagFilterValue(index, option?.value ?? '')}
                    options={(hostTagValueOptions && hostTagValueOptions[filter.tag]) ?? []}
                    width={19}
                    placeholder="Host tag value"
                    createCustomValue={true}
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
