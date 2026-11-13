import React from 'react';
import { render, screen } from '@testing-library/react';
import { HostCell } from './HostCell';

describe('HostCell', () => {
  it('renders the host name', () => {
    render(<HostCell name="db-pg-01" />);

    expect(screen.getByText('db-pg-01')).toBeInTheDocument();
    expect(screen.queryByLabelText('Host in maintenance')).not.toBeInTheDocument();
  });

  it('renders the subtitle on a second line when given', () => {
    render(<HostCell name="db-pg-01" subtitle="Databases / PostgreSQL" />);

    expect(screen.getByText('Databases / PostgreSQL')).toBeInTheDocument();
  });

  it('shows a maintenance marker when the host is in maintenance', () => {
    render(<HostCell name="db-pg-01" maintenance />);

    expect(screen.getByLabelText('Host in maintenance')).toBeInTheDocument();
    expect(screen.getByTestId('wrench')).toBeInTheDocument();
  });
});
