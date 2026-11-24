import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProblemAnnotationsEditor } from './ProblemAnnotationsEditor';

const metricPickerSpy = jest.fn();

jest.mock('../../../components', () => ({
  MetricPicker: (props: any) => {
    metricPickerSpy(props);
    return <div data-testid="trigger-picker" />;
  },
}));

jest.mock('./utils', () => ({
  getVariableOptions: () => [{ value: '$trigger', label: '$trigger' }],
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Combobox: () => <div />,
  InlineSwitch: (props: any) => (
    <input type="checkbox" aria-label={props['aria-label']} checked={!!props.value} onChange={props.onChange} />
  ),
}));

const baseQuery: any = {
  refId: 'A',
  queryType: '0',
  group: { filter: 'Linux' },
  host: { filter: 'web-01' },
  application: { filter: '' },
  itemTag: { filter: '' },
  item: { filter: 'CPU utilization' },
  options: {},
};

const triggers = [
  { triggerid: '10', description: 'High CPU', priority: '4', hosts: [{ name: 'web-01' }] },
  { triggerid: '11', description: 'Low memory', priority: '2', hosts: [{ name: 'web-01' }] },
  { triggerid: '12', description: 'High CPU', priority: '4', hosts: [{ name: 'web-02' }] },
];

const buildDatasource = (problemAnnotationsByDefault = false) => ({
  problemAnnotationsByDefault,
  // Mimic the real interpolation of the trigger filter without template variables
  interpolateVariablesInQueries: (queries: any[]) => queries,
  getProblemAnnotationItemIds: jest.fn().mockResolvedValue(['1']),
  zabbix: { getItemTriggers: jest.fn().mockResolvedValue(triggers) },
});

const renderOpen = (query: any, datasource = buildDatasource(), onChange = jest.fn()) => {
  render(<ProblemAnnotationsEditor query={query} datasource={datasource as any} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Problem annotations' }));
  return onChange;
};

describe('ProblemAnnotationsEditor', () => {
  beforeEach(() => metricPickerSpy.mockClear());

  it('starts collapsed and shows that annotations are off for existing queries', () => {
    render(<ProblemAnnotationsEditor query={baseQuery} datasource={buildDatasource() as any} onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Problem annotations' })).toHaveTextContent('off');
    expect(screen.queryByLabelText('Show problems as annotations')).not.toBeInTheDocument();
  });

  it('reflects the data source default when the query does not set it', () => {
    render(
      <ProblemAnnotationsEditor query={baseQuery} datasource={buildDatasource(true) as any} onChange={jest.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Problem annotations' })).toHaveTextContent('all item triggers');
  });

  it('turns annotations on for the query', () => {
    const onChange = renderOpen(baseQuery);

    fireEvent.click(screen.getByLabelText('Show problems as annotations'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ problemAnnotations: { enabled: true } }));
  });

  it('offers variables, a match-all regex and the distinct trigger names in the metric picker', async () => {
    renderOpen({ ...baseQuery, problemAnnotations: { enabled: true } });

    await waitFor(() =>
      expect(metricPickerSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          value: '',
          placeholder: 'All triggers of these items',
          createCustomValue: true,
          isClearable: true,
          options: [
            { value: '$trigger', label: '$trigger' },
            { value: '/.*/', label: '/.*/' },
            { value: 'High CPU', label: 'High CPU', description: 'web-01' },
            { value: 'Low memory', label: 'Low memory', description: 'web-01' },
          ],
        })
      )
    );
    expect(screen.getByTestId('annotation-trigger-match-count')).toHaveTextContent('3 of 3 triggers');
  });

  it('saves a typed regex as the trigger filter and counts its matches', async () => {
    const datasource = buildDatasource();
    const onChange = jest.fn();
    render(
      <ProblemAnnotationsEditor
        query={{ ...baseQuery, problemAnnotations: { enabled: true, triggerFilter: '/^(?!.*memory).*$/i' } }}
        datasource={datasource as any}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Problem annotations' }));

    await waitFor(() =>
      expect(screen.getByTestId('annotation-trigger-match-count')).toHaveTextContent('2 of 3 triggers')
    );
    expect(screen.getByRole('button', { name: 'Problem annotations' })).toHaveTextContent(
      'triggers /^(?!.*memory).*$/i'
    );

    metricPickerSpy.mock.lastCall[0].onChange('/CPU|memory/');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ problemAnnotations: { enabled: true, triggerFilter: '/CPU|memory/' } })
    );

    // Clearing goes back to every trigger
    metricPickerSpy.mock.lastCall[0].onChange('');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ problemAnnotations: { enabled: true, triggerFilter: '' } })
    );
  });
});
