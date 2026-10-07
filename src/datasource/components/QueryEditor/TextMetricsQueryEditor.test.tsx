import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TextMetricsQueryEditor } from './TextMetricsQueryEditor';
import { ZabbixMetricsQuery, ZabbixTagEvalType } from '../../types/query';
import { HostTagOperatorValue } from './types';
import * as c from '../../constants';

const comboboxSpy = jest.fn();
const radioButtonGroupSpy = jest.fn();
const inputSpy = jest.fn();

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    getVariables: jest.fn(() => []),
  })),
  getBackendSrv: () => ({
    datasourceRequest: jest.fn().mockResolvedValue({ data: { result: '' } }),
    fetch: () => ({
      toPromise: () => jest.fn().mockResolvedValue({ data: { result: '' } }),
    }),
  }),
}));

jest.mock('@grafana/ui', () => ({
  Combobox: (props: any) => {
    comboboxSpy(props);
    return <div />;
  },
  Input: (props: any) => {
    inputSpy(props);
    return <input data-testid="tag-value-input" defaultValue={props.value} onBlur={props.onBlur} />;
  },
  Button: (props: any) => <button aria-label={props['aria-label']} onClick={props.onClick} />,
  Tooltip: ({ children }: any) => <>{children}</>,
  Stack: ({ children }: any) => <div>{children}</div>,
  RadioButtonGroup: (props: any) => {
    radioButtonGroupSpy(props);
    return <div />;
  },
  InlineField: ({ label, children }: any) => (
    <div>
      {label}
      {children}
    </div>
  ),
  InlineSwitch: (props: any) => <input type="checkbox" checked={props.value} onChange={props.onChange} />,
}));

jest.mock('../../hooks/useInterpolatedQuery', () => ({
  useInterpolatedQuery: (datasource: any, query: any) => query,
}));

jest.mock('../../datasource', () => ({
  ZabbixDatasource: jest.fn(),
}));

jest.mock('../../../components', () => ({
  MetricPicker: (props: any) => <div data-testid="metric-picker" />,
}));

jest.mock('./QueryEditorRow', () => ({
  QueryEditorRow: ({ children }: any) => <div>{children}</div>,
}));

const mockDatasource = {
  zabbix: {
    version: '7.0.0',
    getAllGroups: jest.fn().mockResolvedValue([]),
    getAllHosts: jest.fn().mockResolvedValue([]),
    getAllApps: jest.fn().mockResolvedValue([]),
    getAllItems: jest.fn().mockResolvedValue([]),
  },
};

const defaultQuery: ZabbixMetricsQuery = {
  refId: 'A',
  schema: 1,
  queryType: c.MODE_TEXT,
  group: { filter: '' },
  host: { filter: '' },
  application: { filter: '' },
  itemTag: { filter: '' },
  item: { filter: '' },
  macro: { filter: '' },
  textFilter: '',
  mode: 0,
  itemids: '',
  useCaptureGroups: false,
  hostTags: [],
  options: { showDisabledItems: false },
};

describe('TextMetricsQueryEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the host tag editor', () => {
    render(<TextMetricsQueryEditor query={defaultQuery} datasource={mockDatasource as any} onChange={jest.fn()} />);

    expect(screen.getByText('Host tag')).toBeInTheDocument();
  });

  it('updates the query when host tag filter changes', async () => {
    const onChange = jest.fn();
    render(<TextMetricsQueryEditor query={defaultQuery} datasource={mockDatasource as any} onChange={onChange} />);

    await waitFor(() => {
      const addButton = screen.getByLabelText('Add new host tag filter');
      fireEvent.click(addButton);
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        hostTags: [{ tag: '', value: '', operator: HostTagOperatorValue.Contains }],
      })
    );
  });

  it('updates the query when eval type changes', async () => {
    const onChange = jest.fn();
    const queryWithTags = {
      ...defaultQuery,
      hostTags: [{ tag: 'env', value: 'prod', operator: HostTagOperatorValue.Contains }],
    };
    render(<TextMetricsQueryEditor query={queryWithTags} datasource={mockDatasource as any} onChange={onChange} />);

    await waitFor(() => {
      const radioGroup = radioButtonGroupSpy.mock.calls[0];
      if (radioGroup) {
        radioGroup[0].onChange(ZabbixTagEvalType.Or);
      }
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        evaltype: ZabbixTagEvalType.Or,
      })
    );
  });

  it('passes host tag options to the editor', async () => {
    const queryWithTags = {
      ...defaultQuery,
      hostTags: [{ tag: 'env', value: 'prod', operator: HostTagOperatorValue.Contains }],
    };
    render(<TextMetricsQueryEditor query={queryWithTags} datasource={mockDatasource as any} onChange={jest.fn()} />);

    await waitFor(() => {
      const tagCombobox = comboboxSpy.mock.calls.map((call) => call[0]).find((props) => props?.options !== undefined);
      expect(tagCombobox).toBeDefined();
    });
  });
});
