import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ZabbixVariableQueryEditor } from './VariableQueryEditor';
import { VariableQueryTypes } from '../types';
import { HostTagOperatorValue } from './QueryEditor/types';

const comboboxSpy = jest.fn();

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Combobox: (props: any) => {
    comboboxSpy(props);
    const value = typeof props.value === 'object' ? (props.value?.value ?? '') : (props.value ?? '');
    return <input readOnly value={value} data-options={JSON.stringify(props.options ?? [])} />;
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (value: string) => value }),
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

  it('resolves the Zabbix version before labelling the host tag operators', async () => {
    const datasource = {
      zabbix: {
        // Not resolved yet when the editor first opens.
        version: undefined,
        getVersion: jest.fn().mockResolvedValue('7.0.0'),
        getAllHosts: jest
          .fn()
          .mockResolvedValue([{ hostid: '1', name: 'db-1', tags: [{ tag: 'class', value: 'db' }] }]),
        isZabbix54OrHigherSync: () => true,
      },
    };

    render(
      <ZabbixVariableQueryEditor
        query={{
          queryType: VariableQueryTypes.Host,
          group: 'Databases',
          host: '',
          hostTags: [{ tag: 'class', value: 'db', operator: HostTagOperatorValue.DoesNotEqual }],
        }}
        onChange={jest.fn()}
        datasource={datasource}
        templateSrv={{}}
      />
    );

    const operatorInput = screen.getByDisplayValue(HostTagOperatorValue.DoesNotEqual);
    await waitFor(() => expect(operatorInput.getAttribute('data-options')).toContain('Does not equal'));
    expect(operatorInput.getAttribute('data-options')).not.toContain('"Not equal"');
    expect(datasource.zabbix.getVersion).toHaveBeenCalled();
  });
});
