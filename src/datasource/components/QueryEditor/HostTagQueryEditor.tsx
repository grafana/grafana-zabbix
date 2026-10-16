import { Tooltip, Button, Combobox, ComboboxOption, Stack, Input, RadioButtonGroup } from '@grafana/ui';
import React, { FormEvent, useCallback, useState } from 'react';
import { HostTagOperatorLabel, HostTagOperatorValue } from './types';
import { HostTagFilter, ZabbixTagEvalType } from 'datasource/types/query';
import { getHostTagOptionLabel } from './utils';

interface Props {
  hostTagFilters?: HostTagFilter[];
  hostTagOptions: ComboboxOption[];
  hostTagOptionsLoading: boolean;
  version: string;
  evalTypeValue?: ZabbixTagEvalType;
  onHostTagFilterChange?: (hostTags: HostTagFilter[]) => void;
  onHostTagEvalTypeChange?: (evalType: ZabbixTagEvalType) => void;
}

export const HostTagQueryEditor = ({
  hostTagFilters = [],
  hostTagOptions,
  hostTagOptionsLoading,
  version,
  evalTypeValue,
  onHostTagFilterChange,
  onHostTagEvalTypeChange,
}: Props) => {
  const [valueDrafts, setValueDrafts] = useState<Record<number, string>>({});

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

  const onAddHostTagFilter = useCallback(() => {
    onHostTagFilterChange?.([...hostTagFilters, { tag: '', value: '', operator: HostTagOperatorValue.Contains }]);
  }, [hostTagFilters, onHostTagFilterChange]);

  const onRemoveHostTagFilter = useCallback(
    (index: number) => {
      onHostTagFilterChange?.(hostTagFilters.filter((_, i) => i !== index));
      setValueDrafts((prevDrafts) => {
        const nextDrafts: Record<number, string> = {};
        Object.entries(prevDrafts).forEach(([key, draft]) => {
          const i = Number(key);
          if (i < index) {
            nextDrafts[i] = draft;
          } else if (i > index) {
            nextDrafts[i - 1] = draft;
          }
        });
        return nextDrafts;
      });
    },
    [hostTagFilters, onHostTagFilterChange]
  );

  const setHostTagFilterName = useCallback(
    (index: number, name: string) => {
      onHostTagFilterChange?.(hostTagFilters.map((filter, i) => (i === index ? { ...filter, tag: name } : filter)));
    },
    [hostTagFilters, onHostTagFilterChange]
  );

  const setHostTagFilterValue = useCallback(
    (index: number, value: string) => {
      if (value !== undefined) {
        onHostTagFilterChange?.(hostTagFilters.map((filter, i) => (i === index ? { ...filter, value } : filter)));
      }
    },
    [hostTagFilters, onHostTagFilterChange]
  );

  const setHostTagFilterOperator = useCallback(
    (index: number, operator: HostTagOperatorValue) => {
      onHostTagFilterChange?.(hostTagFilters.map((filter, i) => (i === index ? { ...filter, operator } : filter)));
    },
    [hostTagFilters, onHostTagFilterChange]
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
                  <Input
                    value={valueDrafts[index] ?? filter.value}
                    onChange={(evt: FormEvent<HTMLInputElement>) => {
                      const value = evt?.currentTarget?.value ?? '';
                      setValueDrafts((prevDrafts) => ({
                        ...prevDrafts,
                        [index]: value,
                      }));
                    }}
                    onBlur={(evt: FormEvent<HTMLInputElement>) => {
                      setHostTagFilterValue(index, evt?.currentTarget?.value);
                      setValueDrafts((prevDrafts) => {
                        const nextDrafts = { ...prevDrafts };
                        delete nextDrafts[index];
                        return nextDrafts;
                      });
                    }}
                    width={19}
                    placeholder="Host tag value"
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
