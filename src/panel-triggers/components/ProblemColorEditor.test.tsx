import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProblemColorEditor } from './ProblemColorEditor';
import { DEFAULT_SEVERITY } from '../types';
import { ProblemsPanelInstanceState } from '../severityOverrides';

const renderEditor = (instanceState?: ProblemsPanelInstanceState, onChange = jest.fn()) => {
  const props: any = {
    value: DEFAULT_SEVERITY.map((s) => ({ ...s })),
    onChange,
    context: { data: [], instanceState },
    item: { id: 'triggerColors', name: 'Problem colors' },
  };
  render(<ProblemColorEditor {...props} />);
  return { onChange };
};

describe('ProblemColorEditor', () => {
  it('renders one row per severity without any global override indication by default', () => {
    renderEditor();

    expect(screen.getByDisplayValue('Disaster')).toBeInTheDocument();
    expect(screen.queryByText(/Global severity overrides apply/)).not.toBeInTheDocument();
    expect(screen.queryByTestId(/severity-global-override-/)).not.toBeInTheDocument();
  });

  it('shows a banner and marks the rows where a global override is in effect', () => {
    renderEditor({
      globalSeverityOverrides: {
        datasourceNames: ['Zabbix prod'],
        applied: [
          { priority: 4, name: 'Critical', color: 'rgb(200, 0, 0)' },
          { priority: 5, name: 'Outage' },
        ],
      },
    });

    expect(screen.getByText('Global severity overrides apply to this panel')).toBeInTheDocument();
    expect(screen.getByText(/"Zabbix prod"/)).toBeInTheDocument();
    expect(screen.getByTestId('severity-global-override-4')).toHaveTextContent('Critical');
    expect(screen.getByTestId('severity-global-override-5')).toHaveTextContent('Outage');
    expect(screen.queryByTestId('severity-global-override-3')).not.toBeInTheDocument();
    // the panel's own (default) value stays in the input so it is not saved as a customization
    expect(screen.getByDisplayValue('High')).toBeInTheDocument();
  });

  it('emits a new array with the changed severity instead of mutating the value', () => {
    const { onChange } = renderEditor();
    const input = screen.getByDisplayValue('High');
    fireEvent.change(input, { target: { value: 'Critical' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next[4]).toEqual({ ...DEFAULT_SEVERITY[4], severity: 'Critical' });
    expect(next[3]).toEqual(DEFAULT_SEVERITY[3]);
  });

  it('does not emit a change when the name input is blurred unchanged', () => {
    const { onChange } = renderEditor();
    fireEvent.blur(screen.getByDisplayValue('High'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
