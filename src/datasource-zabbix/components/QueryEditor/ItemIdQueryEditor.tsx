import _ from 'lodash';
import React, { useEffect, FormEvent } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineSwitch, Input } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';
import { MetricPicker } from '../../../components';
import { getVariableOptions } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { ZabbixMetricsQuery, ZabbixDSOptions } from '../../types';

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
