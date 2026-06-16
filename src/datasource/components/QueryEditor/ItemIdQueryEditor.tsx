import React, { FormEvent } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { ZabbixMetricsQuery } from '../../types/query';
import { QueryEditorRow } from './QueryEditorRow';

export interface Props {
  query: ZabbixMetricsQuery;
  onChange: (query: ZabbixMetricsQuery) => void;
}

export const ItemIdQueryEditor = ({ query, onChange }: Props) => {
  const onItemIdsChange = (v: FormEvent<HTMLInputElement>) => {
    const newValue = v?.currentTarget?.value;
    if (newValue !== null) {
      onChange({ ...query, itemids: newValue });
    }
  };

  return (
    <QueryEditorRow>
      <InlineField label="Item Ids" labelWidth={12}>
        <Input width={24} defaultValue={query.itemids} onBlur={onItemIdsChange} />
      </InlineField>
    </QueryEditorRow>
  );
};
