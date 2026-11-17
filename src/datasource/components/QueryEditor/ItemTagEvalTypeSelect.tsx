import React from 'react';
import { RadioButtonGroup } from '@grafana/ui';
import { ZabbixTagEvalType } from '../../types/query';
import { isRegex } from '../../utils';

interface Props {
  tagFilter?: string;
  value?: ZabbixTagEvalType;
  onChange: (evalType: ZabbixTagEvalType) => void;
}

// Only meaningful for a comma-separated list of tags; a regex is always matched with OR.
export const ItemTagEvalTypeSelect = ({ tagFilter, value, onChange }: Props) => {
  if (!tagFilter?.includes(',') || isRegex(tagFilter)) {
    return null;
  }
  return (
    <RadioButtonGroup
      options={[
        { label: 'OR', value: ZabbixTagEvalType.Or, description: 'Items with any of the tags' },
        { label: 'AND/OR', value: ZabbixTagEvalType.AndOr, description: 'Items with all tag names' },
      ]}
      value={value ?? ZabbixTagEvalType.Or}
      onChange={onChange}
    />
  );
};
