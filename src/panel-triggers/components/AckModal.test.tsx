import React from 'react';
import moment from 'moment/moment';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AckModal, AckProblemData, SUPPRESS_DATE_FORMAT } from './AckModal';
import {
  ZBX_ACK_ACTION_ACK,
  ZBX_ACK_ACTION_ADD_MESSAGE,
  ZBX_ACK_ACTION_CHANGE_SEVERITY,
  ZBX_ACK_ACTION_CLOSE,
  ZBX_ACK_ACTION_RANK_CAUSE,
  ZBX_ACK_ACTION_RANK_SYMPTOM,
  ZBX_ACK_ACTION_SUPPRESS,
  ZBX_ACK_ACTION_UNACK,
  ZBX_ACK_ACTION_UNSUPPRESS,
} from '../../datasource/constants';

describe('AckModal', () => {
  const mockOnSubmit = jest.fn<Promise<any>, [AckProblemData]>();
  const mockOnDismiss = jest.fn();

  const causeEvents = [
    { value: '100', label: 'Host A: Cause problem' },
    { value: '200', label: 'Host B: Another cause' },
  ];

  const renderModal = (props: any = {}) => {
    return render(<AckModal onSubmit={mockOnSubmit} onDismiss={mockOnDismiss} {...props} />);
  };

  const typeMessage = (text: string) => {
    fireEvent.change(screen.getByPlaceholderText('Message'), { target: { value: text } });
  };

  const clickUpdate = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
  };

  const submittedData = (): AckProblemData => mockOnSubmit.mock.calls[0][0];

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSubmit.mockResolvedValue({});
  });

  describe('rendering of actions', () => {
    it('shows only the base actions by default', () => {
      renderModal();
      expect(screen.getByRole('checkbox', { name: 'Acknowledge' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Change severity' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Unacknowledge' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Suppress' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Unsuppress' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Rank as cause' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Rank as symptom' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Close problem' })).not.toBeInTheDocument();
    });

    it('hides acknowledge when the problem is already acknowledged', () => {
      renderModal({ canAck: false, canUnack: true });
      expect(screen.queryByRole('checkbox', { name: 'Acknowledge' })).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Unacknowledge' })).toBeInTheDocument();
    });

    it('shows suppress and unsuppress independently', () => {
      renderModal({ canSuppress: true });
      expect(screen.getByRole('checkbox', { name: 'Suppress' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Unsuppress' })).not.toBeInTheDocument();
    });

    it('shows unsuppress only for suppressed problems', () => {
      renderModal({ canUnsuppress: true });
      expect(screen.getByRole('checkbox', { name: 'Unsuppress' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Suppress' })).not.toBeInTheDocument();
    });

    it('shows rank actions independently', () => {
      renderModal({ canRankAsSymptom: true });
      expect(screen.getByRole('checkbox', { name: 'Rank as symptom' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Rank as cause' })).not.toBeInTheDocument();
    });

    it('shows rank as cause only for symptom problems', () => {
      renderModal({ canRankAsCause: true });
      expect(screen.getByRole('checkbox', { name: 'Rank as cause' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Rank as symptom' })).not.toBeInTheDocument();
    });

    it('shows close problem when problem allows manual close', () => {
      renderModal({ canClose: true });
      expect(screen.getByRole('checkbox', { name: 'Close problem' })).toBeInTheDocument();
    });

    it('shows the three suppress time options only when suppress is selected', () => {
      renderModal({ canSuppress: true });
      expect(screen.queryByLabelText('Indefinitely')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Suppress' }));
      expect(screen.getByLabelText('Indefinitely')).toBeInTheDocument();
      expect(screen.getByLabelText('For duration')).toBeInTheDocument();
      expect(screen.getByLabelText('Until date')).toBeInTheDocument();
    });

    it('shows the cause event dropdown only when rank as symptom is selected', () => {
      renderModal({ canRankAsSymptom: true, causeEvents });
      expect(screen.queryByLabelText('Cause event')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Rank as symptom' }));
      expect(screen.getByLabelText('Cause event')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows an error when no message and no action is selected', () => {
      renderModal();
      clickUpdate();
      expect(screen.getByText('Enter message text or select an action')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('shows an error when ranking as symptom without a cause event selected', () => {
      renderModal({ canRankAsSymptom: true, causeEvents });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Rank as symptom' }));
      clickUpdate();
      expect(screen.getByText('Select the cause event to rank this problem as symptom')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('shows a live error for an invalid suppress duration and blocks submit', () => {
      renderModal({ canSuppress: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Suppress' }));
      fireEvent.click(screen.getByLabelText('For duration'));
      fireEvent.change(screen.getByLabelText('Suppress duration'), { target: { value: 'not-a-duration' } });
      // The error appears while typing, before any submit attempt
      expect(screen.getByText('Invalid suppress duration. Use values like 30m, 1h or 2d.')).toBeInTheDocument();
      clickUpdate();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('shows a live error for an invalid suppress date format and blocks submit', () => {
      renderModal({ canSuppress: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Suppress' }));
      fireEvent.click(screen.getByLabelText('Until date'));
      fireEvent.change(screen.getByLabelText('Suppress until date'), { target: { value: '31/12/2100' } });
      expect(screen.getByText(`Invalid date. Use format ${SUPPRESS_DATE_FORMAT}.`)).toBeInTheDocument();
      clickUpdate();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('shows a live error when the suppress date is not in the future and blocks submit', () => {
      renderModal({ canSuppress: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Suppress' }));
      fireEvent.click(screen.getByLabelText('Until date'));
      fireEvent.change(screen.getByLabelText('Suppress until date'), { target: { value: '2000-01-01 00:00' } });
      expect(screen.getByText('Suppress until date must be in the future.')).toBeInTheDocument();
      clickUpdate();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('clears the live error when a valid date is entered', () => {
      renderModal({ canSuppress: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Suppress' }));
      fireEvent.click(screen.getByLabelText('Until date'));
      const dateInput = screen.getByLabelText('Suppress until date');
      fireEvent.change(dateInput, { target: { value: 'garbage' } });
      expect(screen.getByText(`Invalid date. Use format ${SUPPRESS_DATE_FORMAT}.`)).toBeInTheDocument();
      fireEvent.change(dateInput, { target: { value: '2100-01-01 12:00' } });
      expect(screen.queryByText(`Invalid date. Use format ${SUPPRESS_DATE_FORMAT}.`)).not.toBeInTheDocument();
    });
  });

  describe('submitting actions', () => {
    it('submits add message action when only a message is entered', () => {
      renderModal();
      typeMessage('a message');
      clickUpdate();
      expect(submittedData()).toEqual({ message: 'a message', action: ZBX_ACK_ACTION_ADD_MESSAGE });
    });

    it('submits acknowledge with message', () => {
      renderModal();
      typeMessage('ack it');
      fireEvent.click(screen.getByRole('checkbox', { name: 'Acknowledge' }));
      clickUpdate();
      expect(submittedData()).toEqual({
        message: 'ack it',
        action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_ACK,
      });
    });

    it('always includes the add message flag so the acting Grafana user is recorded', () => {
      renderModal();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Acknowledge' }));
      clickUpdate();
      expect(submittedData()).toEqual({ message: '', action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_ACK });
    });

    it('submits unacknowledge action', () => {
      renderModal({ canAck: false, canUnack: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Unacknowledge' }));
      clickUpdate();
      expect(submittedData()).toEqual({ message: '', action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_UNACK });
    });

    it('submits change severity with selected severity', () => {
      renderModal({ severity: 2 });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Change severity' }));
      fireEvent.click(screen.getByLabelText('Disaster'));
      clickUpdate();
      expect(submittedData()).toEqual({ message: '', action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_CHANGE_SEVERITY, severity: 5 });
    });

    it('submits close problem action', () => {
      renderModal({ canClose: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Close problem' }));
      clickUpdate();
      expect(submittedData()).toEqual({ message: '', action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_CLOSE });
    });

    it('submits indefinite suppression by default', () => {
      renderModal({ canSuppress: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Suppress' }));
      clickUpdate();
      expect(submittedData()).toEqual({ message: '', action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_SUPPRESS, suppress_until: 0 });
    });

    it('submits suppression until now plus the entered duration', () => {
      const nowMs = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(nowMs);
      renderModal({ canSuppress: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Suppress' }));
      fireEvent.click(screen.getByLabelText('For duration'));
      fireEvent.change(screen.getByLabelText('Suppress duration'), { target: { value: '2h' } });
      clickUpdate();
      expect(submittedData()).toEqual({
        message: '',
        action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_SUPPRESS,
        suppress_until: nowMs / 1000 + 7200,
      });
      jest.restoreAllMocks();
    });

    it('submits suppression until the entered date', () => {
      renderModal({ canSuppress: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Suppress' }));
      fireEvent.click(screen.getByLabelText('Until date'));
      fireEvent.change(screen.getByLabelText('Suppress until date'), { target: { value: '2100-01-01 12:00' } });
      clickUpdate();
      expect(submittedData()).toEqual({
        message: '',
        action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_SUPPRESS,
        suppress_until: moment('2100-01-01 12:00', SUPPRESS_DATE_FORMAT, true).unix(),
      });
    });

    it('submits unsuppress action', () => {
      renderModal({ canUnsuppress: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Unsuppress' }));
      clickUpdate();
      expect(submittedData()).toEqual({ message: '', action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_UNSUPPRESS });
    });

    it('submits rank as cause action', () => {
      renderModal({ canRankAsCause: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Rank as cause' }));
      clickUpdate();
      expect(submittedData()).toEqual({ message: '', action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_RANK_CAUSE });
    });

    it('submits rank as symptom with the cause event selected from the dropdown', async () => {
      renderModal({ canRankAsSymptom: true, causeEvents });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Rank as symptom' }));

      await userEvent.click(screen.getByLabelText('Cause event'));
      await userEvent.click(await screen.findByText('Host B: Another cause'));

      clickUpdate();
      expect(submittedData()).toEqual({
        message: '',
        action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_RANK_SYMPTOM,
        cause_eventid: '200',
      });
    });

    it('submits combined actions as a single bitmask', () => {
      renderModal({ canClose: true });
      typeMessage('closing');
      fireEvent.click(screen.getByRole('checkbox', { name: 'Acknowledge' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Close problem' }));
      clickUpdate();
      expect(submittedData()).toEqual({
        message: 'closing',
        action: ZBX_ACK_ACTION_ADD_MESSAGE + ZBX_ACK_ACTION_ACK + ZBX_ACK_ACTION_CLOSE,
      });
    });

    it('dismisses the modal after a successful submit', async () => {
      renderModal();
      typeMessage('a message');
      clickUpdate();
      await waitFor(() => expect(mockOnDismiss).toHaveBeenCalled());
    });

    it('shows the error and keeps the modal open when submit fails', async () => {
      mockOnSubmit.mockRejectedValue({ data: { message: 'Permission denied' } });
      renderModal();
      typeMessage('a message');
      clickUpdate();
      await waitFor(() => expect(screen.getByText('Permission denied')).toBeInTheDocument());
      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe('mutually exclusive actions', () => {
    it('unchecks acknowledge when unacknowledge is selected and vice versa', () => {
      // Both flags forced on to verify the safety exclusion, even though real
      // problems only ever show one of the two.
      renderModal({ canAck: true, canUnack: true });
      const ack = screen.getByRole('checkbox', { name: 'Acknowledge' });
      const unack = screen.getByRole('checkbox', { name: 'Unacknowledge' });
      fireEvent.click(ack);
      expect(ack).toBeChecked();
      fireEvent.click(unack);
      expect(unack).toBeChecked();
      expect(ack).not.toBeChecked();
      fireEvent.click(ack);
      expect(ack).toBeChecked();
      expect(unack).not.toBeChecked();
    });

    it('unchecks suppress when unsuppress is selected and vice versa', () => {
      // Query elements after every click: toggling suppress mounts/unmounts the
      // suppress-until options, which remounts the sibling checkboxes.
      renderModal({ canSuppress: true, canUnsuppress: true });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Suppress' }));
      expect(screen.getByRole('checkbox', { name: 'Suppress' })).toBeChecked();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Unsuppress' }));
      expect(screen.getByRole('checkbox', { name: 'Unsuppress' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Suppress' })).not.toBeChecked();
    });

    it('unchecks rank as cause when rank as symptom is selected and vice versa', () => {
      renderModal({ canRankAsCause: true, canRankAsSymptom: true, causeEvents });
      const cause = screen.getByRole('checkbox', { name: 'Rank as cause' });
      const symptom = screen.getByRole('checkbox', { name: 'Rank as symptom' });
      fireEvent.click(cause);
      expect(cause).toBeChecked();
      fireEvent.click(symptom);
      expect(symptom).toBeChecked();
      expect(cause).not.toBeChecked();
    });
  });
});
