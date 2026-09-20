import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { computeAutoPageSize, DEFAULT_PAGE_SIZE, ProblemList, ProblemListProps } from './Problems';
import { ProblemDTO, ZBXAlert, ZBXEvent } from '../../../datasource/types';
import { ProblemsPanelOptions, DEFAULT_SEVERITY } from '../../types';
import { APIExecuteScriptResponse, ZBXScript } from '../../../datasource/zabbix/connectors/zabbix_api/types';

// Mock @grafana/runtime
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {},
  getDataSourceSrv: () => ({
    getInstanceSettings: (uid: string) =>
      ({
        'uid-1': { name: 'ds-b' },
        'uid-2': { name: 'ds-d' },
        'uid-3': { name: 'ds-a' },
        'uid-4': { name: 'ds-c' },
      })[uid],
  }),
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
    statusField: true,
    statusIcon: true,
    opdataField: false,
    ackField: true,
    showTags: true,
    showDatasourceName: false,
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
      const ageHeader = headers.find((header) => header.textContent?.includes('Age'));

      expect(ageHeader).toBeInTheDocument();
    });

    it('should not render the age column header when ageField is disabled', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, ageField: false },
        problems: [createMockProblem('1', 1609459200)],
      };

      render(<ProblemList {...props} />);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      const ageHeader = headers.find((header) => header.textContent?.includes('Age'));

      expect(ageHeader).toBeUndefined();
    });
  });

  describe('Status Field', () => {
    it('should render the status column header when statusField is enabled', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, statusField: true },
        problems: [createMockProblem('1', 1609459200)],
      };

      render(<ProblemList {...props} />);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      const statusHeader = headers.find((header) => header.textContent === 'Status');

      expect(statusHeader).toBeInTheDocument();
    });

    it('should not render the status column header when statusField is disabled', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, statusField: false },
        problems: [createMockProblem('1', 1609459200)],
      };

      render(<ProblemList {...props} />);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      const statusHeader = headers.find((header) => header.textContent === 'Status');

      expect(statusHeader).toBeUndefined();
    });
  });

  describe('Severity Field', () => {
    it('should render the severity column header when severityField is enabled', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, severityField: true },
        problems: [createMockProblem('1', 1609459200)],
      };

      render(<ProblemList {...props} />);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      const severityHeader = headers.find((header) => header.textContent?.includes('Severity'));

      expect(severityHeader).toBeInTheDocument();
    });

    it('should not render the severity column header when severityField is disabled', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, severityField: false },
        problems: [createMockProblem('1', 1609459200)],
      };

      render(<ProblemList {...props} />);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      const severityHeader = headers.find((header) => header.textContent?.includes('Severity'));

      expect(severityHeader).toBeUndefined();
    });
  });

  describe('Ack Field', () => {
    it('should render the ack column header when ackField is enabled', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, ackField: true },
        problems: [createMockProblem('1', 1609459200)],
      };

      render(<ProblemList {...props} />);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      const ackHeader = headers.find((header) => header.textContent === 'Ack');

      expect(ackHeader).toBeInTheDocument();
    });

    it('should not render the ack column header when ackField is disabled', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, ackField: false },
        problems: [createMockProblem('1', 1609459200)],
      };

      render(<ProblemList {...props} />);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      const ackHeader = headers.find((header) => header.textContent === 'Ack');

      expect(ackHeader).toBeUndefined();
    });
  });

  describe('Datasource Field', () => {
    it('should not render the datasource column header when showDatasourceName is disabled', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, showDatasourceName: false },
        problems: [createMockProblem('1', 1609459200)],
      };

      render(<ProblemList {...props} />);

      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      const datasourceHeader = headers.find((header) => header.textContent?.includes('Datasource'));

      expect(datasourceHeader).toBeUndefined();
    });
  });

  // Reads the host name (first line of the host cell) for each rendered row, in display order
  const getHostColumn = () => {
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    const hostIndex = headers.findIndex((header) => header.textContent?.includes('Host'));
    return within(table)
      .getAllByRole('row')
      .slice(1) // skip the header row
      .map((row) =>
        row.querySelectorAll('td')[hostIndex]?.querySelector('[data-testid="host-name"]')?.textContent?.trim()
      );
  };

  describe('Sorting', () => {
    it('should reorder rows when a sortable header is clicked', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, sortProblems: 'default' as const },
        problems: [
          { ...createMockProblem('1', 1000), host: 'Test Host 1' }, // oldest -> biggest age
          { ...createMockProblem('2', 3000), host: 'Test Host 2' },
          { ...createMockProblem('3', 2000), host: 'Test Host 3' },
        ],
      };

      render(<ProblemList {...props} />);

      const table = screen.getByRole('table');
      const ageHeader = within(table)
        .getAllByRole('columnheader')
        .find((header) => header.textContent?.includes('Age'))!;

      const sortButton = within(ageHeader).getByRole('button');

      // First click sorts descending (biggest age first) and shows the indicator
      fireEvent.click(sortButton);
      expect(ageHeader).toHaveAttribute('aria-sort', 'descending');
      expect(within(ageHeader).getByTestId('angle-down')).toBeInTheDocument();
      expect(getHostColumn()).toEqual(['Test Host 1', 'Test Host 3', 'Test Host 2']);

      // Second click toggles to ascending (smallest age, i.e. newest problem, first)
      fireEvent.click(sortButton);
      expect(ageHeader).toHaveAttribute('aria-sort', 'ascending');
      expect(within(ageHeader).getByTestId('angle-up')).toBeInTheDocument();
      expect(getHostColumn()).toEqual(['Test Host 2', 'Test Host 3', 'Test Host 1']);
    });

    it('should apply the initial order from the sortProblems panel option', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, sortProblems: 'priority' as const },
        // Severity order deliberately differs from time order, so a wrong
        // (time-based) initial sort cannot produce the expected result.
        problems: [
          { ...createMockProblem('1', 3000), host: 'Test Host 1', severity: '1', priority: '1' }, // newest, lowest severity
          { ...createMockProblem('2', 1000), host: 'Test Host 2', severity: '5', priority: '5' }, // oldest, highest severity
          { ...createMockProblem('3', 2000), host: 'Test Host 3', severity: '3', priority: '3' },
        ],
      };

      render(<ProblemList {...props} />);

      // Severity descending, without any header click
      expect(getHostColumn()).toEqual(['Test Host 2', 'Test Host 3', 'Test Host 1']);
    });

    // Panel options that make every sortable column visible
    const allColumnsOptions: ProblemsPanelOptions = {
      ...defaultPanelOptions,
      sortProblems: 'default',
      hostTechNameField: true,
      hostGroups: true,
      hostProxy: true,
      opdataField: true,
      showDatasourceName: true,
      customTagColumns: 'env',
    };

    // Four rows whose per-column values produce a distinct, known ascending
    // order for every sortable column. Hosts double as row identity.
    const sortableColumnProblems = [
      {
        ...createMockProblem('1', 4000), // newest
        host: 'srv1',
        hostTechName: 'tech-b',
        groups: [{ groupid: '1', name: 'Beta' }],
        proxy: 'proxy-c',
        severity: '2',
        priority: '2',
        name: 'Alpha issue',
        opdata: 'op-d',
        datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: 'uid-1' }, // ds-b
        tags: [{ tag: 'env', value: 'stage' }],
      },
      {
        ...createMockProblem('2', 1000), // oldest
        host: 'srv2',
        hostTechName: 'tech-d',
        groups: [{ groupid: '2', name: 'Delta' }],
        proxy: 'proxy-a',
        severity: '5',
        priority: '5',
        name: 'Charlie issue',
        opdata: 'op-b',
        datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: 'uid-3' }, // ds-a
        tags: [{ tag: 'env', value: 'dev' }],
      },
      {
        ...createMockProblem('3', 3000),
        host: 'SRV3',
        hostTechName: 'tech-a',
        groups: [{ groupid: '3', name: 'Alpha' }],
        proxy: 'proxy-d',
        severity: '1',
        priority: '1',
        name: 'Delta issue',
        opdata: 'op-a',
        datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: 'uid-2' }, // ds-d
        tags: [{ tag: 'env', value: 'test' }],
      },
      {
        ...createMockProblem('4', 2000),
        host: 'srv10',
        hostTechName: 'tech-c',
        groups: [],
        proxy: 'proxy-b',
        severity: '4',
        priority: '4',
        name: 'Bravo issue',
        opdata: 'op-c',
        datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: 'uid-4' }, // ds-c
        tags: [{ tag: 'env', value: 'prod' }],
      },
    ];

    // Finds a header by its label
    const findHeader = (label: string) => {
      const table = screen.getByRole('table');
      return within(table)
        .getAllByRole('columnheader')
        .find((header) => header.textContent?.trim() === label);
    };

    it('should expose a sort control only on sortable columns', () => {
      render(<ProblemList {...defaultProps} panelOptions={allColumnsOptions} problems={sortableColumnProblems} />);

      const sortable = [
        'Host',
        'Host (Technical Name)',
        'Host Groups',
        'Proxy',
        'Severity',
        'Problem',
        'Operational data',
        'Datasource',
        'Age',
        'Time',
        'Env', // custom tag column
      ];
      for (const label of sortable) {
        const header = findHeader(label);
        expect(header).toBeDefined();
        expect(header).toHaveAttribute('aria-sort', 'none');
        expect(within(header!).getByRole('button')).toBeInTheDocument();
      }

      const notSortable = ['Status', 'Status Icon', 'Ack', 'Tags'];
      for (const label of notSortable) {
        const header = findHeader(label);
        expect(header).toBeDefined();
        expect(header).not.toHaveAttribute('aria-sort');
        expect(within(header!).queryByRole('button')).toBeNull();
      }
    });

    it('should sort every sortable column in both directions', () => {
      render(<ProblemList {...defaultProps} panelOptions={allColumnsOptions} problems={sortableColumnProblems} />);

      // Expected ascending order per column, expressed as host row identities
      const cases: Array<[string, string[]]> = [
        ['Host', ['srv1', 'srv2', 'SRV3', 'srv10']], // natural, case-insensitive
        ['Host (Technical Name)', ['SRV3', 'srv1', 'srv10', 'srv2']],
        ['Host Groups', ['srv10', 'SRV3', 'srv1', 'srv2']], // '' < Alpha < Beta < Delta
        ['Proxy', ['srv2', 'srv10', 'srv1', 'SRV3']],
        ['Severity', ['SRV3', 'srv1', 'srv10', 'srv2']], // 1 < 2 < 4 < 5
        ['Problem', ['srv1', 'srv10', 'srv2', 'SRV3']],
        ['Operational data', ['SRV3', 'srv2', 'srv10', 'srv1']],
        ['Datasource', ['srv2', 'srv1', 'srv10', 'SRV3']], // by resolved name, not uid
        ['Age', ['srv1', 'SRV3', 'srv10', 'srv2']], // newest (smallest age) first
        ['Time', ['srv2', 'srv10', 'SRV3', 'srv1']], // oldest first
        ['Env', ['srv2', 'srv10', 'srv1', 'SRV3']], // dev < prod < stage < test
      ];

      for (const [label, expectedAsc] of cases) {
        const header = findHeader(label)!;
        expect(header).toBeDefined();

        // Two clicks cover both directions; which comes first depends on the
        // column's auto sort direction, so accept either order.
        const sortButton = within(header).getByRole('button');
        fireEvent.click(sortButton);
        const firstClick = getHostColumn();
        fireEvent.click(sortButton);
        const secondClick = getHostColumn();

        expect([firstClick, secondClick]).toContainEqual(expectedAsc);
        expect([firstClick, secondClick]).toContainEqual([...expectedAsc].reverse());
      }
    });
  });

  describe('Page size', () => {
    const manyProblems = Array.from({ length: 30 }, (_, i) => createMockProblem(String(i + 1), 1000 + i));

    it('uses the saved fixed page size', () => {
      render(<ProblemList {...defaultProps} pageSize={5} problems={manyProblems} />);

      expect(getHostColumn()).toHaveLength(5);
      expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('5');
    });

    it('defaults to auto, keeping the default row count until the panel is laid out', () => {
      render(<ProblemList {...defaultProps} pageSize="auto" problems={manyProblems} />);

      expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('auto');
      expect(getHostColumn()).toHaveLength(DEFAULT_PAGE_SIZE);
    });

    it('reports the chosen size, including switching back to auto', () => {
      render(<ProblemList {...defaultProps} pageSize={5} problems={manyProblems} />);
      const select = screen.getByRole('combobox', { name: 'Rows per page' });

      fireEvent.change(select, { target: { value: '20' } });
      expect(mockOnPageSizeChange).toHaveBeenLastCalledWith(20, 0);
      expect(getHostColumn()).toHaveLength(20);

      fireEvent.change(select, { target: { value: 'auto' } });
      expect(mockOnPageSizeChange).toHaveBeenLastCalledWith('auto', 0);
    });
  });

  describe('Search Filter', () => {
    it('should filter rows by the search input and restore them when cleared', () => {
      const props = {
        ...defaultProps,
        panelOptions: { ...defaultPanelOptions, showSearchFilter: true },
        problems: [
          { ...createMockProblem('1', 1000), name: 'CPU load too high' },
          { ...createMockProblem('2', 2000), name: 'Disk space low' },
          { ...createMockProblem('3', 3000), name: 'High memory usage' },
        ],
      };

      render(<ProblemList {...props} />);

      const searchInput = screen.getByRole('textbox', { name: 'Search problems' });

      // Case-insensitive match across visible columns
      fireEvent.change(searchInput, { target: { value: 'high' } });
      expect(getHostColumn()).toHaveLength(2);
      expect(screen.getByText('CPU load too high')).toBeInTheDocument();
      expect(screen.getByText('High memory usage')).toBeInTheDocument();
      expect(screen.queryByText('Disk space low')).not.toBeInTheDocument();

      // Clearing the input restores all rows
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(getHostColumn()).toHaveLength(3);
    });
  });
});

describe('computeAutoPageSize', () => {
  it('fits whole rows into the available height', () => {
    expect(computeAutoPageSize(416, 52)).toBe(8);
    expect(computeAutoPageSize(430, 52)).toBe(8);
  });

  it('shows at least one row in a very short panel', () => {
    expect(computeAutoPageSize(30, 52)).toBe(1);
  });

  it('falls back to the default before the panel is laid out', () => {
    expect(computeAutoPageSize(0, 52)).toBe(DEFAULT_PAGE_SIZE);
    expect(computeAutoPageSize(400, 0)).toBe(DEFAULT_PAGE_SIZE);
  });
});
