import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ProblemList, ProblemListProps } from './Problems';
import { ProblemDTO, ZBXAlert, ZBXEvent } from '../../../datasource/types';
import { ProblemsPanelOptions, DEFAULT_SEVERITY } from '../../types';
import { APIExecuteScriptResponse, ZBXScript } from '../../../datasource/zabbix/connectors/zabbix_api/types';

// Mock @grafana/runtime
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {},
}));

describe('ProblemList', () => {
  const mockGetProblemEvents = jest.fn<Promise<ZBXEvent[]>, [ProblemDTO]>();
  const mockGetProblemAlerts = jest.fn<Promise<ZBXAlert[]>, [ProblemDTO]>();
  const mockGetScripts = jest.fn<Promise<ZBXScript[]>, [ProblemDTO]>();
  const mockOnExecuteScript = jest.fn<Promise<APIExecuteScriptResponse>, [ProblemDTO, string, string]>();
  const mockOnProblemAck = jest.fn();
  const mockOnTagClick = jest.fn();
  const mockOnPageSizeChange = jest.fn();
  const mockOnColumnResize = jest.fn();

  const defaultPanelOptions: ProblemsPanelOptions = {
    datasources: [],
    fontSize: '100%',
    layout: 'table',
    schemaVersion: 1,
    targets: [],
    hostField: true,
    hostTechNameField: false,
    hostGroups: false,
    hostProxy: false,
    severityField: true,
    statusIcon: true,
    opdataField: false,
    ackField: true,
    showTags: true,
    ageField: true,
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

  const createMockProblem = (id: string, timestamp: number): ProblemDTO => ({
    eventid: id,
    name: `Test Problem ${id}`,
    acknowledged: '0',
    value: '1',
    severity: '3',
    priority: '3',
    host: `Test Host ${id}`,
    hostTechName: `host-${id}`,
    hostInMaintenance: false,
    groups: [],
    proxy: '',
    tags: [],
    url: '',
    opdata: '',
    datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: 'test-ds' },
    timestamp,
    acknowledges: [],
    suppressed: '0',
    suppression_data: [],
    comments: '',
  });

  const defaultProps: ProblemListProps = {
    problems: [],
    panelOptions: defaultPanelOptions,
    loading: false,
    pageSize: 10,
    fontSize: 100,
    panelId: 1,
    getProblemEvents: mockGetProblemEvents,
    getProblemAlerts: mockGetProblemAlerts,
    getScripts: mockGetScripts,
    onExecuteScript: mockOnExecuteScript,
    onProblemAck: mockOnProblemAck,
    onTagClick: mockOnTagClick,
    onPageSizeChange: mockOnPageSizeChange,
    onColumnResize: mockOnColumnResize,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Age Field', () => {
    it('should render the age column header when ageField is enabled', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, ageField: true },
        problems: [createMockProblem('1', 1609459200)], // 2021-01-01 00:00:00 UTC
      };

      render(<ProblemList {...props} />);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      const ageHeader = headers.find((header) => header.textContent === 'Age');

      expect(ageHeader).toBeInTheDocument();
    });
  });
});
