import React from 'react';
import { render } from '@testing-library/react';
import { ZabbixVariableQueryEditor } from './VariableQueryEditor';
import { VariableQueryTypes } from '../types';

const comboboxSpy = jest.fn();

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Combobox: (props: any) => {
    comboboxSpy(props);
    return <div data-testid="query-type-combobox" />;
  },
}));

const renderEditor = (query: any) => {
  const onChange = jest.fn();
  const result = render(
    <ZabbixVariableQueryEditor query={query} onChange={onChange} datasource={{}} templateSrv={{}} />
  );
  return { onChange, ...result };
};

const selectedQueryType = () => comboboxSpy.mock.calls[comboboxSpy.mock.calls.length - 1][0].value;

describe('ZabbixVariableQueryEditor', () => {
  beforeEach(() => {
    comboboxSpy.mockClear();
  });

  it('renders the default query type when no query is saved yet', () => {
    renderEditor(undefined);

    expect(selectedQueryType()).toEqual({ value: VariableQueryTypes.Group, label: 'Group' });
  });

  it('falls back to the default query type for a query without a queryType (#2465)', () => {
    renderEditor({});

    expect(selectedQueryType()).toEqual({ value: VariableQueryTypes.Group, label: 'Group' });
  });

  it('falls back to the default query type for a query from another datasource', () => {
    renderEditor({ refId: 'A', expr: 'up' });

    expect(selectedQueryType()).toEqual({ value: VariableQueryTypes.Group, label: 'Group' });
  });

  it('falls back to the default query type for a queryType the editor cannot represent', () => {
    renderEditor({ queryType: VariableQueryTypes.Macro });

    expect(selectedQueryType()).toEqual({ value: VariableQueryTypes.Group, label: 'Group' });
  });

  it('keeps the saved query type', () => {
    renderEditor({ queryType: VariableQueryTypes.Item, group: 'a', host: 'b', item: 'c' });

    expect(selectedQueryType()).toEqual({ value: VariableQueryTypes.Item, label: 'Item' });
  });

  it('renders a legacy string query', () => {
    renderEditor('{group}{host}');

    expect(selectedQueryType()).toEqual({ value: VariableQueryTypes.Host, label: 'Host' });
  });
});
