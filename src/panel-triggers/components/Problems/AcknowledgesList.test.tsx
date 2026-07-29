import React from 'react';
import { render, screen } from '@testing-library/react';
import AcknowledgesList from './AcknowledgesList';
import { ZBXAcknowledge } from '../../../datasource/types';

describe('AcknowledgesList', () => {
  const createAck = (action: string, message = 'test message'): ZBXAcknowledge => ({
    acknowledgeid: '1',
    eventid: '10',
    userid: '1',
    action,
    clock: '1700000000',
    time: '2023-11-14 22:13:20',
    message,
    user: 'admin',
    alias: 'admin',
    name: 'Zabbix',
    surname: 'Administrator',
  });

  const renderWithAction = (action: string) => {
    render(<AcknowledgesList acknowledges={[createAck(action)]} />);
  };

  it.each([
    ['2', '(Acknowledged) test message'],
    ['16', '(Unacknowledged) test message'],
    ['32', '(Suppressed) test message'],
    ['64', '(Unsuppressed) test message'],
    ['8', '(Changed severity) test message'],
    ['128', '(Ranked as cause) test message'],
    ['256', '(Ranked as symptom) test message'],
  ])('decodes action %s as "%s"', (action, expected) => {
    renderWithAction(action);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('decodes combined action flags', () => {
    // acknowledge (2) + add message (4) + change severity (8)
    renderWithAction('14');
    expect(screen.getByText('(Acknowledged) (Changed severity) test message')).toBeInTheDocument();
  });

  it('renders plain message for add message action', () => {
    renderWithAction('4');
    expect(screen.getByText('test message')).toBeInTheDocument();
  });

  it('renders the user name', () => {
    renderWithAction('2');
    expect(screen.getByText('Zabbix Administrator')).toBeInTheDocument();
  });
});
