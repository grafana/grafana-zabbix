import React, { FormEvent, useCallback, useState } from 'react';
import { Button, Combobox, ComboboxOption, Input, RadioButtonGroup, Stack, Tooltip } from '@grafana/ui';
import { ProblemTagFilter, ZabbixTagEvalType } from 'datasource/types/query';
import { TagOperatorLabel, TagOperatorValue } from './types';
import { getHostTagOptionLabel } from './utils';

interface Props {
  tagFilters: ProblemTagFilter[];
  // Tag name suggestions (template variables and tags of the problems the panel fetched)
  tagOptions?: Array<ComboboxOption<string>>;
  version: string;
  // Zabbix >= 5.4 (problem.get/event.get accept operators other than Contains/Equals)
  supportsExtendedOperators: boolean;
  evalType?: ZabbixTagEvalType;
  onChange: (tagFilters: ProblemTagFilter[]) => void;
  onEvalTypeChange: (evalType: ZabbixTagEvalType) => void;
}

const evalTypeOptions = [
  { label: 'AND/OR', value: ZabbixTagEvalType.AndOr },
  { label: 'OR', value: ZabbixTagEvalType.Or },
];

export const ProblemTagFilterEditor = ({
  tagFilters,
  tagOptions,
  version,
  supportsExtendedOperators,
  evalType,
  onChange,
  onEvalTypeChange,
}: Props) => {
  const [valueDrafts, setValueDrafts] = useState<Record<number, string>>({});

  const operatorOptions: Array<ComboboxOption<TagOperatorValue>> = [
    ...(supportsExtendedOperators
      ? [{ value: TagOperatorValue.Exists, label: TagOperatorLabel.Exists as string }]
      : []),
    { value: TagOperatorValue.Equals, label: TagOperatorLabel.Equals },
    { value: TagOperatorValue.Contains, label: TagOperatorLabel.Contains },
    ...(supportsExtendedOperators
      ? [
          {
            value: TagOperatorValue.DoesNotExist,
            label: getHostTagOptionLabel(TagOperatorValue.DoesNotExist, version),
          },
          {
            value: TagOperatorValue.DoesNotEqual,
            label: getHostTagOptionLabel(TagOperatorValue.DoesNotEqual, version),
          },
          {
            value: TagOperatorValue.DoesNotContain,
            label: getHostTagOptionLabel(TagOperatorValue.DoesNotContain, version),
          },
        ]
      : []),
  ];

  const onAddTagFilter = useCallback(() => {
    onChange([...tagFilters, { tag: '', value: '', operator: TagOperatorValue.Contains }]);
  }, [tagFilters, onChange]);

  const onRemoveTagFilter = useCallback(
    (index: number) => {
      onChange(tagFilters.filter((_, i) => i !== index));
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
    [tagFilters, onChange]
  );

  const setTagFilterProp = useCallback(
    (index: number, prop: Partial<ProblemTagFilter>) => {
      onChange(tagFilters.map((filter, i) => (i === index ? { ...filter, ...prop } : filter)));
    },
    [tagFilters, onChange]
  );

  return (
    <div>
      <Stack direction="row">
        <Tooltip content="Add tag filter">
          <Button icon="plus" variant="secondary" aria-label="Add new tag filter" onClick={onAddTagFilter} />
        </Tooltip>
        {tagFilters.length > 0 && (
          <RadioButtonGroup
            options={evalTypeOptions}
            onChange={onEvalTypeChange}
            value={evalType ?? ZabbixTagEvalType.AndOr}
          />
        )}
      </Stack>
      <Stack direction="column">
        {tagFilters.map((filter, index) => {
          return (
            <Stack key={`problem-tag-filter-${index}`} direction="row">
              <Combobox
                value={filter.tag}
                onChange={(option: ComboboxOption) => setTagFilterProp(index, { tag: option.value })}
                options={tagOptions ?? []}
                width={19}
                createCustomValue={true}
                placeholder="Tag"
              />
              <Combobox
                value={filter.operator}
                onChange={(option: ComboboxOption<TagOperatorValue>) =>
                  setTagFilterProp(index, { operator: option.value })
                }
                options={operatorOptions}
                width={19}
              />
              {filter.operator !== TagOperatorValue.Exists && filter.operator !== TagOperatorValue.DoesNotExist && (
                <Input
                  value={valueDrafts[index] ?? filter.value}
                  onChange={(evt: FormEvent<HTMLInputElement>) => {
                    const value = evt?.currentTarget?.value ?? '';
                    setValueDrafts((prevDrafts) => ({ ...prevDrafts, [index]: value }));
                  }}
                  onBlur={(evt: FormEvent<HTMLInputElement>) =>
                    setTagFilterProp(index, { value: evt?.currentTarget?.value ?? '' })
                  }
                  width={19}
                  placeholder="Tag value"
                />
              )}
              <Tooltip content="Remove tag filter">
                <Button
                  key={`remove-problem-tag-${index}`}
                  icon="minus"
                  variant="secondary"
                  aria-label="Remove tag filter"
                  onClick={() => onRemoveTagFilter(index)}
                />
              </Tooltip>
            </Stack>
          );
        })}
      </Stack>
    </div>
  );
};
