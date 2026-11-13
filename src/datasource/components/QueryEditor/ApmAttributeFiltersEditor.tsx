import React, { FormEvent, useCallback, useState } from 'react';
import { Button, Combobox, ComboboxOption, Input, Stack, Tooltip } from '@grafana/ui';
import { ApmAttributeFilter, ApmAttributeScope } from 'datasource/types/query';

interface Props {
  value?: ApmAttributeFilter[];
  onChange: (filters: ApmAttributeFilter[]) => void;
}

const scopeOptions: Array<ComboboxOption<ApmAttributeScope>> = [
  { value: 'resource', label: 'Resource' },
  { value: 'scope', label: 'Scope' },
  { value: 'log', label: 'Log' },
];

// apmlog.get attribute filter operators
const operatorOptions: Array<ComboboxOption<number>> = [
  { value: 0, label: 'Contains' },
  { value: 1, label: 'Equals' },
  { value: 2, label: 'Does not contain' },
  { value: 3, label: 'Does not equal' },
  { value: 4, label: 'Exists' },
  { value: 5, label: 'Does not exist' },
];

const OP_EXISTS = 4;
const OP_NOT_EXISTS = 5;

export const ApmAttributeFiltersEditor = ({ value, onChange }: Props) => {
  const [filters, setFilters] = useState<ApmAttributeFilter[]>(value ?? []);

  const update = useCallback(
    (next: ApmAttributeFilter[]) => {
      setFilters(next);
      onChange(next);
    },
    [onChange]
  );

  const onAdd = () => {
    update([...filters, { scope: 'resource', key: '', value: '', operator: 0 }]);
  };

  const onRemove = (index: number) => {
    update(filters.filter((_, i) => i !== index));
  };

  const onFieldChange = (index: number, field: keyof ApmAttributeFilter, fieldValue: any) => {
    update(filters.map((f, i) => (i === index ? { ...f, [field]: fieldValue } : f)));
  };

  return (
    <div>
      <Stack direction="row">
        <Tooltip content="Add attribute filter">
          <Button icon="plus" variant="secondary" aria-label="Add new attribute filter" onClick={onAdd} />
        </Tooltip>
      </Stack>
      <Stack direction="column">
        {filters.map((filter, index) => (
          <Stack key={`apm-attribute-filter-${index}`} direction="row">
            <Combobox
              value={filter.scope}
              onChange={(option: ComboboxOption<ApmAttributeScope>) => onFieldChange(index, 'scope', option.value)}
              options={scopeOptions}
              width={13}
            />
            <Input
              defaultValue={filter.key}
              onBlur={(evt: FormEvent<HTMLInputElement>) => onFieldChange(index, 'key', evt?.currentTarget?.value)}
              width={19}
              placeholder="Attribute key"
            />
            <Combobox
              value={filter.operator}
              onChange={(option: ComboboxOption<number>) => onFieldChange(index, 'operator', option.value)}
              options={operatorOptions}
              width={17}
            />
            {filter.operator !== OP_EXISTS && filter.operator !== OP_NOT_EXISTS && (
              <Input
                defaultValue={filter.value}
                onBlur={(evt: FormEvent<HTMLInputElement>) => onFieldChange(index, 'value', evt?.currentTarget?.value)}
                width={19}
                placeholder="Attribute value"
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
      </Stack>
    </div>
  );
};
