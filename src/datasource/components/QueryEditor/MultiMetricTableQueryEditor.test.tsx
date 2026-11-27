import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MultiMetricTableQueryEditor } from './MultiMetricTableQueryEditor';

jest.mock('../../../components/MetricPicker/MetricPicker', () => ({
  MetricPicker: () => null,
}));

jest.mock('./HostTagQueryEditor', () => ({
  HostTagQueryEditor: () => null,
}));

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    getVariables: jest.fn(() => []),
  })),
}));

const buildDatasource = (): any => ({
  zabbix: {
    getAllGroups: jest.fn().mockResolvedValue([]),
    getAllHosts: jest.fn().mockResolvedValue([]),
    getAllItems: jest.fn().mockResolvedValue([]),
    isZabbix54OrHigher: jest.fn().mockResolvedValue(false),
    version: '7.0.0',
  },
  interpolateVariablesInQueries: jest.fn((queries: any[]) => queries),
});

const queryWithColumns = (names: string[]): any => ({
  refId: 'A',
  queryType: '7',
  group: { filter: '' },
  host: { filter: '' },
  application: { filter: '' },
  itemTag: { filter: '' },
  hostTags: [],
  tableConfig: {
    rowSource: 'host',
    entityPattern: { searchType: 'itemName', pattern: '' },
    metrics: names.map((columnName) => ({ columnName, searchType: 'itemName', pattern: '', aggregation: 'last' })),
  },
});

describe('MultiMetricTableQueryEditor', () => {
  it('shows a column renamed outside the editor and does not write the old name back on blur', async () => {
    const datasource = buildDatasource();
    const onChange = jest.fn();
    const { rerender } = render(
      <MultiMetricTableQueryEditor
        query={queryWithColumns(['CPU', 'Memory'])}
        datasource={datasource}
        onChange={onChange}
      />
    );
    expect(await screen.findByDisplayValue('CPU')).toBeInTheDocument();

    // Same number of columns, only the name changed (for example in the query JSON).
    rerender(
      <MultiMetricTableQueryEditor
        query={queryWithColumns(['CPU load', 'Memory'])}
        datasource={datasource}
        onChange={onChange}
      />
    );

    const input = await screen.findByDisplayValue('CPU load');
    expect(screen.queryByDisplayValue('CPU')).not.toBeInTheDocument();

    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });
});
