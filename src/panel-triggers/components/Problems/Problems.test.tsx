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

      const sortButton = within(ageHeader).getByRole('button', { name: 'Age' });

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
        expect(within(header!).getByRole('button', { name: label })).toBeInTheDocument();
      }

      const notSortable = ['Status', 'Status Icon', 'Ack', 'Tags'];
      for (const label of notSortable) {
        const header = findHeader(label);
        expect(header).toBeDefined();
        expect(header).not.toHaveAttribute('aria-sort');
        expect(within(header!).queryByRole('button', { name: label })).toBeNull();
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
        const sortButton = within(header).getByRole('button', { name: label });
        fireEvent.click(sortButton);
        const firstClick = getHostColumn();
        fireEvent.click(sortButton);
        const secondClick = getHostColumn();

        expect([firstClick, secondClick]).toContainEqual(expectedAsc);
        expect([firstClick, secondClick]).toContainEqual([...expectedAsc].reverse());
      }
    });
  });

  describe('Column order', () => {
    const getHeaderLabels = () =>
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent?.trim());

    const defaultLabels = ['Host', 'Severity', 'Status Icon', 'Status', 'Problem', 'Ack', 'Tags', 'Age', 'Time', ''];

    it('renders columns in the definition order when no order is saved', () => {
      render(<ProblemList {...defaultProps} problems={[createMockProblem('1', 1000)]} />);
      expect(getHeaderLabels()).toEqual(defaultLabels);
    });

    it('renders columns in the saved order, slotting unknown columns in and pinning the expander last', () => {
      // "age" is not in the saved order (its field was toggled on later), "proxy" is stale,
      // and the expander is listed first but must stay last
      const columnOrder = [
        'expander',
        'name',
        'proxy',
        'tags',
        'host',
        'priority',
        'value',
        'statusIcon',
        'acknowledged',
      ];
      render(
        <ProblemList
          {...defaultProps}
          panelOptions={{ ...defaultPanelOptions, columnOrder }}
          problems={[createMockProblem('1', 1000)]}
        />
      );
      // "age" precedes "lastchange" in the definition order, so it lands after "tags" here,
      // in front of the unknown "lastchange" which follows it
      expect(getHeaderLabels()).toEqual([
        'Problem',
        'Tags',
        'Age',
        'Time',
        'Host',
        'Severity',
        'Status',
        'Status Icon',
        'Ack',
        '',
      ]);
    });

    it('renders body cells in the same order as the headers', () => {
      const columnOrder = [
        'name',
        'host',
        'priority',
        'statusIcon',
        'value',
        'acknowledged',
        'tags',
        'age',
        'lastchange',
      ];
      render(
        <ProblemList
          {...defaultProps}
          panelOptions={{ ...defaultPanelOptions, columnOrder }}
          problems={[createMockProblem('1', 1000)]}
        />
      );
      const firstRow = within(screen.getByRole('table')).getAllByRole('row')[1];
      const cells = within(firstRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent);
      expect(cells[0]).toContain('Test Problem 1');
      expect(cells[1]).toContain('Test Host 1');
    });

    it('offers a reorder grip on every column except the expander', () => {
      render(<ProblemList {...defaultProps} problems={[createMockProblem('1', 1000)]} />);
      const headers = within(screen.getByRole('table')).getAllByRole('columnheader');
      const grips = headers.map((header) => header.querySelector('[data-testid^="column-grip-"]'));
      expect(grips.slice(0, -1).every(Boolean)).toBe(true);
      expect(grips[grips.length - 1]).toBeNull();
      // Mouse-only affordance, kept out of the accessibility tree
      expect(grips[0]).toHaveAttribute('aria-hidden', 'true');
    });

    describe('mouse drag', () => {
      // Header cells are laid out side by side, 100px each, so the pointer position picks a column
      const originalGetRect = HTMLElement.prototype.getBoundingClientRect;
      const originalPointerEvent = window.PointerEvent;

      beforeEach(() => {
        HTMLElement.prototype.getBoundingClientRect = function () {
          const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) };
          if (this instanceof HTMLTableCellElement && this.tagName === 'TH') {
            const left = this.cellIndex * 100;
            return { ...rect, x: left, left, right: left + 100, width: 100, bottom: 36, height: 36 };
          }
          return rect;
        };
        // jsdom has no PointerEvent; a MouseEvent carries the coordinates the drag reads
        if (!window.PointerEvent) {
          window.PointerEvent = class PointerEvent extends MouseEvent {
            pointerId = 1;
          } as unknown as typeof window.PointerEvent;
        }
      });

      afterEach(() => {
        HTMLElement.prototype.getBoundingClientRect = originalGetRect;
        window.PointerEvent = originalPointerEvent;
      });

      const grip = (columnId: string) => screen.getByTestId(`column-grip-${columnId}`);

      it('moves a column to the slot of the header it is dropped on and reports the new order', () => {
        const onColumnReorder = jest.fn();
        render(
          <ProblemList {...defaultProps} onColumnReorder={onColumnReorder} problems={[createMockProblem('1', 1000)]} />
        );

        // Host (0-100px) dragged onto Status Icon (200-300px)
        fireEvent.pointerDown(grip('host'), { button: 0, clientX: 10 });
        fireEvent.pointerMove(document, { clientX: 150 });
        fireEvent.pointerMove(document, { clientX: 250 });
        // The lifted copy of the header is drawn outside the table while dragging
        expect(screen.getAllByText('Host')).toHaveLength(2);
        fireEvent.pointerUp(document, { clientX: 250 });
        expect(screen.getAllByText('Host')).toHaveLength(1);

        expect(getHeaderLabels()).toEqual([
          'Severity',
          'Status Icon',
          'Host',
          'Status',
          'Problem',
          'Ack',
          'Tags',
          'Age',
          'Time',
          '',
        ]);
        expect(onColumnReorder).toHaveBeenCalledTimes(1);
        const order: string[] = onColumnReorder.mock.calls[0][0];
        // Host took the Status Icon slot in the full order, which also lists the hidden columns
        expect(order.indexOf('statusIcon')).toBeLessThan(order.indexOf('host'));
        expect(order.indexOf('host')).toBeLessThan(order.indexOf('value'));
        expect(order).toContain('hostTechName');
        expect(order[order.length - 1]).toBe('expander');
      });

      it('shows the insertion line on the header under the pointer while dragging', () => {
        render(<ProblemList {...defaultProps} problems={[createMockProblem('1', 1000)]} />);
        const headers = within(screen.getByRole('table')).getAllByRole('columnheader');

        fireEvent.pointerDown(grip('host'), { button: 0, clientX: 10 });
        fireEvent.pointerMove(document, { clientX: 250 });
        // Host comes from the left, so the line sits on the right edge of Status Icon
        expect(headers[2].className).toMatch(/dropAfter|css-/);
        expect(headers[2].getAttribute('class')).not.toEqual(headers[3].getAttribute('class'));
        fireEvent.pointerUp(document, { clientX: 250 });
        expect(headers[2].getAttribute('class')).toEqual(headers[3].getAttribute('class'));
      });

      it('ignores a plain click and a release outside the header row', () => {
        const onColumnReorder = jest.fn();
        render(
          <ProblemList {...defaultProps} onColumnReorder={onColumnReorder} problems={[createMockProblem('1', 1000)]} />
        );

        // Click without moving
        fireEvent.pointerDown(grip('host'), { button: 0, clientX: 10 });
        fireEvent.pointerUp(document, { clientX: 10 });
        // Wiggle under the activation distance
        fireEvent.pointerDown(grip('host'), { button: 0, clientX: 10 });
        fireEvent.pointerMove(document, { clientX: 14 });
        fireEvent.pointerUp(document, { clientX: 14 });
        // Real drag released past the last column
        fireEvent.pointerDown(grip('host'), { button: 0, clientX: 10 });
        fireEvent.pointerMove(document, { clientX: 5000 });
        fireEvent.pointerUp(document, { clientX: 5000 });

        expect(getHeaderLabels()).toEqual(defaultLabels);
        expect(onColumnReorder).not.toHaveBeenCalled();
      });

      it('does not let the grip start a sort', () => {
        render(
          <ProblemList
            {...defaultProps}
            panelOptions={{ ...defaultPanelOptions, sortProblems: 'default' }}
            problems={[createMockProblem('1', 1000)]}
          />
        );
        const hostHeader = within(screen.getByRole('table')).getAllByRole('columnheader')[0];
        fireEvent.pointerDown(grip('host'), { button: 0, clientX: 10 });
        fireEvent.pointerUp(document, { clientX: 10 });
        fireEvent.click(grip('host'));
        expect(hostHeader).toHaveAttribute('aria-sort', 'none');
      });
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
