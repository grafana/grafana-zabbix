import React from 'react';
import { render, screen } from '@testing-library/react';
import { Cell } from '@tanstack/react-table';
import { SeverityCell } from './SeverityCell';
import { ProblemDTO } from '../../../../datasource/types';
import { DEFAULT_SEVERITY } from '../../../types';

// Minimal stand-in for a TanStack cell: the component only reads getValue() and row.original
const makeCell = (value: string, original: Partial<ProblemDTO>) =>
  ({ getValue: () => value, row: { original } }) as unknown as Cell<ProblemDTO, string>;

describe('SeverityCell', () => {
  it('renders the configured severity name in its colour', () => {
    render(
      <SeverityCell cell={makeCell('1', { severity: '3', acknowledged: '0' })} problemSeverityDesc={DEFAULT_SEVERITY} />
    );

    const pill = screen.getByText('Average').parentElement!;
    expect(pill).toHaveStyle({ color: 'rgb(255, 137, 30)' });
    expect(pill.style.background).toContain('rgba(255, 137, 30, 0.15)');
  });

  it('uses the panel severity options rather than the defaults', () => {
    const custom = [{ priority: 3, severity: 'Medium', color: '#123456', show: true }];
    render(<SeverityCell cell={makeCell('1', { severity: '3', acknowledged: '0' })} problemSeverityDesc={custom} />);

    expect(screen.getByText('Medium').parentElement).toHaveStyle({ color: '#123456' });
  });

  it('uses the OK colour for resolved problems', () => {
    render(
      <SeverityCell
        cell={makeCell('0', { severity: '4', acknowledged: '0' })}
        problemSeverityDesc={DEFAULT_SEVERITY}
        okColor="rgb(1, 2, 3)"
      />
    );

    expect(screen.getByText('High').parentElement).toHaveStyle({ color: 'rgb(1, 2, 3)' });
  });

  it('uses the ack colour for acknowledged problems when markAckEvents is on', () => {
    render(
      <SeverityCell
        cell={makeCell('1', { severity: '4', acknowledged: '1' })}
        problemSeverityDesc={DEFAULT_SEVERITY}
        markAckEvents
        ackEventColor="rgb(9, 8, 7)"
      />
    );

    expect(screen.getByText('High').parentElement).toHaveStyle({ color: 'rgb(9, 8, 7)' });
  });

  it('falls back to the raw severity when it is not in the options', () => {
    render(
      <SeverityCell cell={makeCell('1', { severity: '9', acknowledged: '0' })} problemSeverityDesc={DEFAULT_SEVERITY} />
    );

    expect(screen.getByText('9')).toBeInTheDocument();
  });
});
