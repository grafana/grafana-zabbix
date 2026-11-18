import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  const allCapabilities = { unacknowledge: true, suppress: true };

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
    comments: '',
    actionCapabilities: allCapabilities,
    ...overrides,
  });

  const renderDetails = async (problem: ProblemDTO) => {
    const result = render(
      <ProblemDetails
        original={problem}
        rootWidth={1000}
        timeRange={getDefaultTimeRange()}
        panelId={1}
        datasourceName="zabbix-ds"
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

  it('offers unsuppress but not suppress for a manually suppressed problem', async () => {
    await renderDetails(
      createProblem({ suppressed: '1', suppression_data: [{ maintenanceid: '0', userid: '1', suppress_until: '0' }] })
    );
    await openAckModal();
    expect(screen.getByRole('checkbox', { name: 'Unsuppress' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Suppress' })).not.toBeInTheDocument();
  });

  it('offers suppress but not unsuppress for a problem suppressed only by maintenance', async () => {
    await renderDetails(
      createProblem({
        suppressed: '1',
        suppression_data: [{ maintenanceid: '5', userid: '0', suppress_until: '1800000000' }],
      })
    );
    await openAckModal();
    expect(screen.getByRole('checkbox', { name: 'Suppress' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Unsuppress' })).not.toBeInTheDocument();
  });

  it('hides version-gated actions when the server does not support them', async () => {
    await renderDetails(
      createProblem({
        acknowledged: '1',
        suppressed: '1',
        actionCapabilities: { unacknowledge: false, suppress: false },
      })
    );
    await openAckModal();
    expect(screen.queryByRole('checkbox', { name: 'Unacknowledge' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Suppress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Unsuppress' })).not.toBeInTheDocument();
  });

  it('hides close problem when manual close is not allowed', async () => {
    await renderDetails(createProblem({ manual_close: '0' }));
    await openAckModal();
    expect(screen.queryByRole('checkbox', { name: 'Close problem' })).not.toBeInTheDocument();
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
  describe('description', () => {
    const description = 'Line one of the description.\nLine two with more details.';
    const descriptionProblem = () =>
      createProblem({
        name: 'Service is unavailable',
        comments: description,
        hosts: [{ hostid: '1', name: 'test-host-1' } as any],
      });
    const descriptionTrigger = () => screen.getByRole('button', { name: 'Open the full problem description' });

    let writeText: jest.Mock;

    beforeEach(() => {
      writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    });

    it('opens a modal with the full description when clicked', async () => {
      await renderDetails(descriptionProblem());

      await act(async () => {
        fireEvent.click(descriptionTrigger());
      });

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Problem description')).toBeInTheDocument();
      expect(within(dialog).getByText('test-host-1')).toBeInTheDocument();
      expect(screen.getByTestId('problem-description-modal-content')).toHaveTextContent('Line two with more details.');
    });

    it('opens the modal when the description text is clicked', async () => {
      await renderDetails(descriptionProblem());

      await act(async () => {
        fireEvent.click(screen.getByText(/^Description:/));
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('opens the modal from the keyboard', async () => {
      await renderDetails(descriptionProblem());

      await act(async () => {
        fireEvent.keyDown(descriptionTrigger(), { key: 'Enter' });
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('copies the description to the clipboard', async () => {
      await renderDetails(descriptionProblem());

      await act(async () => {
        fireEvent.click(descriptionTrigger());
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Copy to clipboard/ }));
      });

      await waitFor(() => expect(writeText).toHaveBeenCalledWith(description));
    });

    it('closes the modal', async () => {
      await renderDetails(descriptionProblem());

      await act(async () => {
        fireEvent.click(descriptionTrigger());
      });
      await act(async () => {
        fireEvent.click(within(screen.getByRole('dialog')).getByText('Close'));
      });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not render the description row when there is no description', async () => {
      await renderDetails(createProblem({ comments: '' }));

      expect(screen.queryByRole('button', { name: 'Open the full problem description' })).not.toBeInTheDocument();
    });
  });
});
