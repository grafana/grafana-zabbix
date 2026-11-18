import React from 'react';
import { Button, Combobox, ComboboxOption, Stack, Tooltip } from '@grafana/ui';
import { ApmMetricAttributeFilter, ApmMetricAttributeScope } from '../../types/query';
import { ApmMetricAttributes } from '../../zabbix/types';
import { getVariableOptions } from './utils';

interface Props {
  value?: ApmMetricAttributeFilter[];
  // Attribute keys and values seen in the data, offered as suggestions
  attributes?: ApmMetricAttributes;
  onChange: (filters: ApmMetricAttributeFilter[]) => void;
}

const scopeOptions: Array<ComboboxOption<ApmMetricAttributeScope>> = [
  { value: 'metric', label: 'Metric', description: 'Data point attributes' },
  { value: 'resource', label: 'Resource', description: 'Resource attributes' },
  { value: 'scope', label: 'Scope', description: 'Instrumentation scope attributes' },
];

// apmmetric.get attribute filter operators
export const APM_OPERATOR_EQUALS = 1;
const APM_OPERATOR_EXISTS = 4;
const APM_OPERATOR_NOT_EXISTS = 5;

const operatorOptions: Array<ComboboxOption<number>> = [
  { value: APM_OPERATOR_EQUALS, label: 'Equals' },
  { value: 3, label: 'Does not equal' },
  { value: 0, label: 'Contains' },
  { value: 2, label: 'Does not contain' },
  { value: APM_OPERATOR_EXISTS, label: 'Exists' },
  { value: APM_OPERATOR_NOT_EXISTS, label: 'Does not exist' },
];

const toOptions = (values: string[]): Array<ComboboxOption<string>> => values.map((v) => ({ value: v, label: v }));

export const ApmMetricAttributeFiltersEditor = ({ value, attributes, onChange }: Props) => {
  const filters = value ?? [];

  const onAdd = () => {
    onChange([...filters, { scope: 'metric', key: '', value: '', operator: APM_OPERATOR_EQUALS }]);
  };

  const onRemove = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const onFieldChange = (index: number, patch: Partial<ApmMetricAttributeFilter>) => {
    onChange(filters.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const keyOptions = (scope: ApmMetricAttributeScope) => {
    const known = scope === 'scope' ? {} : (attributes?.[scope] ?? {});
    return toOptions(Object.keys(known).sort());
  };

  const valueOptions = (filter: ApmMetricAttributeFilter) => {
    const known = filter.scope === 'scope' ? {} : (attributes?.[filter.scope] ?? {});
    return [...getVariableOptions(), ...toOptions([...(known[filter.key] ?? [])].sort())];
  };

  return (
    <Stack direction="column" gap={0.5}>
      {filters.map((filter, index) => (
        <Stack key={`apm-metric-attribute-filter-${index}`} direction="row" gap={0.5}>
          <Combobox<ApmMetricAttributeScope>
            aria-label="Attribute scope"
            value={filter.scope}
            options={scopeOptions}
            onChange={(option) => onFieldChange(index, { scope: option.value })}
            width={14}
          />
          <Combobox<string>
            aria-label="Attribute key"
            value={filter.key || null}
            options={keyOptions(filter.scope)}
            onChange={(option) => onFieldChange(index, { key: option?.value ?? '' })}
            createCustomValue={true}
            placeholder="Attribute key"
            width={28}
          />
          <Combobox<number>
            aria-label="Attribute operator"
            value={filter.operator}
            options={operatorOptions}
            onChange={(option) => onFieldChange(index, { operator: option.value })}
            width={18}
          />
          {filter.operator !== APM_OPERATOR_EXISTS && filter.operator !== APM_OPERATOR_NOT_EXISTS && (
            <Combobox<string>
              aria-label="Attribute value"
              value={filter.value || null}
              options={valueOptions(filter)}
              onChange={(option) => onFieldChange(index, { value: option?.value ?? '' })}
              createCustomValue={true}
              placeholder="Attribute value"
              width={28}
            />
          )}
          <Tooltip content="Remove attribute filter">
            <Button
              icon="minus"
              variant="secondary"
              aria-label="Remove attribute filter"
              onClick={() => onRemove(index)}
            />
          </Tooltip>
        </Stack>
      ))}
      <Stack direction="row">
        <Tooltip content="Add attribute filter">
          <Button icon="plus" variant="secondary" aria-label="Add attribute filter" onClick={onAdd} />
        </Tooltip>
      </Stack>
    </Stack>
  );
};
