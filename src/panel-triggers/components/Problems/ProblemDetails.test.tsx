import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemDetails } from './ProblemDetails';
import { ProblemDTO } from '../../../datasource/types';
import { getDefaultTimeRange } from '@grafana/data';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {
    bootData: { user: { lightTheme: false } },
  },
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ({ name: 'zabbix-ds' }),
  }),
}));

describe('ProblemDetails', () => {
  const mockGetProblemEvents = jest.fn().mockResolvedValue([]);
  const mockGetProblemAlerts = jest.fn().mockResolvedValue([]);
  const mockGetScripts = jest.fn().mockResolvedValue([]);
  const mockOnExecuteScript = jest.fn();
  const mockOnProblemAck = jest.fn().mockResolvedValue({});

  const allCapabilities = { unacknowledge: true, suppress: true, rank: true };

  const createProblem = (overrides: Partial<ProblemDTO> = {}): ProblemDTO => ({
    eventid: '10',
    triggerid: '100',
    name: 'Test problem',
    description: 'Test problem',
    severity: '3',
    acknowledged: '0',
    value: '1',
    timestamp: 1700000000,
    manual_close: '1',
    showAckButton: true,
    datasource: 'zabbix',
    tags: [],
    acknowledges: [],
    suppressed: '0',
    cause_eventid: '0',
    comments: '',
    actionCapabilities: allCapabilities,
    ...overrides,
  });

  const renderDetails = async (problem: ProblemDTO, panelProblems?: ProblemDTO[]) => {
    const result = render(
      <ProblemDetails
        original={problem}
        rootWidth={1000}
        timeRange={getDefaultTimeRange()}
        panelId={1}
        panelProblems={panelProblems}
        getProblemEvents={mockGetProblemEvents}
        getProblemAlerts={mockGetProblemAlerts}
        getScripts={mockGetScripts}
        onExecuteScript={mockOnExecuteScript}
        onProblemAck={mockOnProblemAck}
      />
    );
    // Let the initial data fetch effect settle before interacting with the component
    await waitFor(() => expect(mockGetProblemAlerts).toHaveBeenCalled());
    return result;
  };

  const openAckModal = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge problem' }));
    await waitFor(() => expect(screen.getByText('Update Problem')).toBeInTheDocument());
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProblemAlerts.mockResolvedValue([]);
    mockGetProblemEvents.mockResolvedValue([]);
  });

  it('renders the acknowledge action button when showAckButton is set', async () => {
    await renderDetails(createProblem());
    expect(screen.getByRole('button', { name: 'Acknowledge problem' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Execute script' })).toBeInTheDocument();
  });

  it('hides action buttons when showAckButton is not set', async () => {
    await renderDetails(createProblem({ showAckButton: false }));
    expect(screen.queryByRole('button', { name: 'Acknowledge problem' })).not.toBeInTheDocument();
  });

  it('offers acknowledge but not unacknowledge for an unacknowledged problem', async () => {
    await renderDetails(createProblem({ acknowledged: '0' }));
    await openAckModal();
    expect(screen.getByRole('checkbox', { name: 'Acknowledge' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Unacknowledge' })).not.toBeInTheDocument();
  });

  it('offers unacknowledge but not acknowledge for an acknowledged problem', async () => {
    await renderDetails(createProblem({ acknowledged: '1' }));
    await openAckModal();
    expect(screen.getByRole('checkbox', { name: 'Unacknowledge' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Acknowledge' })).not.toBeInTheDocument();
  });

  it('offers suppress but not unsuppress for a problem which is not suppressed', async () => {
    await renderDetails(createProblem({ suppressed: '0' }));
    await openAckModal();
    expect(screen.getByRole('checkbox', { name: 'Suppress' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Unsuppress' })).not.toBeInTheDocument();
  });

  it('offers unsuppress but not suppress for a suppressed problem', async () => {
    await renderDetails(createProblem({ suppressed: '1' }));
    await openAckModal();
    expect(screen.getByRole('checkbox', { name: 'Unsuppress' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Suppress' })).not.toBeInTheDocument();
  });

  it('offers rank as symptom but not rank as cause for a cause problem', async () => {
    await renderDetails(createProblem({ cause_eventid: '0' }));
    await openAckModal();
    expect(screen.getByRole('checkbox', { name: 'Rank as symptom' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Rank as cause' })).not.toBeInTheDocument();
  });

  it('offers rank as cause but not rank as symptom for a symptom problem', async () => {
    await renderDetails(createProblem({ cause_eventid: '999' }));
    await openAckModal();
    expect(screen.getByRole('checkbox', { name: 'Rank as cause' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Rank as symptom' })).not.toBeInTheDocument();
  });

  it('hides version-gated actions when the server does not support them', async () => {
    await renderDetails(
      createProblem({
        acknowledged: '1',
        suppressed: '1',
        actionCapabilities: { unacknowledge: false, suppress: false, rank: false },
      })
    );
    await openAckModal();
    expect(screen.queryByRole('checkbox', { name: 'Unacknowledge' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Suppress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Unsuppress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Rank as cause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Rank as symptom' })).not.toBeInTheDocument();
  });

  it('hides close problem when manual close is not allowed', async () => {
    await renderDetails(createProblem({ manual_close: '0' }));
    await openAckModal();
    expect(screen.queryByRole('checkbox', { name: 'Close problem' })).not.toBeInTheDocument();
  });

  it('offers other cause problems from the panel in the cause event dropdown', async () => {
    const problem = createProblem();
    const panelProblems = [
      problem,
      createProblem({ eventid: '20', name: 'Other cause', host: 'host-b', cause_eventid: '0' }),
      createProblem({ eventid: '30', name: 'A symptom', host: 'host-c', cause_eventid: '20' }),
    ];
    await renderDetails(problem, panelProblems);
    await openAckModal();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Rank as symptom' }));
    await userEvent.click(screen.getByLabelText('Cause event'));

    // Only the other cause problem is offered: not the problem itself, not symptoms
    expect(await screen.findByText('host-b: Other cause')).toBeInTheDocument();
    expect(screen.queryByText('host-c: A symptom')).not.toBeInTheDocument();
  });

  it('submits the selected actions to onProblemAck', async () => {
    const problem = createProblem({ acknowledged: '1' });
    await renderDetails(problem);
    await openAckModal();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Unacknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(mockOnProblemAck).toHaveBeenCalledTimes(1));
    const [submittedProblem, ackData] = mockOnProblemAck.mock.calls[0];
    expect(submittedProblem.eventid).toBe('10');
    // unacknowledge (16) + always-on add message (4)
    expect(ackData).toEqual({ message: '', action: 20 });
  });
});
