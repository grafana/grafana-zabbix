import React from 'react';
import { render, screen } from '@testing-library/react';
import AlertCard from './AlertCard';
import { ProblemDTO } from '../../../datasource/types';
import { ProblemsPanelOptions, DEFAULT_SEVERITY } from '../../types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ({ name: 'test-ds' }),
  }),
}));

describe('AlertCard', () => {
  const defaultPanelOptions: ProblemsPanelOptions = {
    datasources: [],
    fontSize: '100%',
    layout: 'list',
    schemaVersion: 1,
    targets: [],
    hostField: true,
    hostTechNameField: false,
    hostIpField: false,
    hostGroups: false,
    hostProxy: false,
    severityField: true,
    statusField: true,
    statusIcon: false,
    opdataField: false,
    ackField: true,
    showTags: true,
    showDatasourceName: false,
    ageField: false,
    customLastChangeFormat: false,
    lastChangeFormat: '',
    highlightNewEvents: false,
    highlightNewerThan: '',
    markAckEvents: false,
    ackEventColor: 'rgb(56, 219, 156)',
    okEventColor: 'rgb(56, 189, 113)',
    triggerSeverity: DEFAULT_SEVERITY,
    problemTimeline: false,
    allowDangerousHTML: false,
    resizedColumns: [],
  };

  const createMockProblem = (): ProblemDTO => ({
    name: 'Test problem',
    description: 'Test problem',
    severity: '3',
    value: '1',
    host: 'Test Host',
    hostTechName: 'test-host',
    hostIp: '',
    tags: [],
    datasource: 'test-ds',
    timestamp: 1609459200,
    acknowledged: '0',
    acknowledges: [],
    suppressed: '0',
    comments: '',
  });

  it('should not render the host IP by default', () => {
    const problem = { ...createMockProblem(), hostIp: '192.168.1.10' };

    render(<AlertCard problem={problem} panelOptions={defaultPanelOptions} />);

    expect(screen.queryByText('192.168.1.10')).not.toBeInTheDocument();
  });

  it('should render the host IP after the host name when hostIpField is enabled', () => {
    const problem = { ...createMockProblem(), hostIp: '192.168.1.10' };
    const panelOptions = { ...defaultPanelOptions, hostIpField: true };

    const { container } = render(<AlertCard problem={problem} panelOptions={panelOptions} />);

    expect(screen.getByText('192.168.1.10')).toBeInTheDocument();
    expect(container.textContent).toMatch(/Test Host.*192\.168\.1\.10/);
  });

  it('should render comma-separated IPs when the host has multiple interfaces', () => {
    const problem = { ...createMockProblem(), hostIp: '192.168.1.10, 10.0.0.5' };
    const panelOptions = { ...defaultPanelOptions, hostIpField: true };

    render(<AlertCard problem={problem} panelOptions={panelOptions} />);

    expect(screen.getByText('192.168.1.10, 10.0.0.5')).toBeInTheDocument();
  });

  it('should render nothing for the IP when it is empty (no interfaces or DNS-based)', () => {
    const problem = { ...createMockProblem(), hostIp: '' };
    const panelOptions = { ...defaultPanelOptions, hostIpField: true };

    const { container } = render(<AlertCard problem={problem} panelOptions={panelOptions} />);

    // Only the AlertHost span should be present, no extra empty hostname span
    expect(container.querySelectorAll('.zabbix-hostname')).toHaveLength(1);
  });
});
