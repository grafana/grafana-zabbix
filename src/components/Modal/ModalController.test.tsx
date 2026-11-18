import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ModalController } from './ModalController';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    bootData: { user: { lightTheme: false } },
  },
}));

interface TestModalProps {
  onDismiss?: () => void;
}

// A modal with local state: typing into the input must survive parent re-renders
const TestModal = (_props: TestModalProps) => {
  const [value, setValue] = useState('');
  return (
    <div>
      <span>Test modal</span>
      <input aria-label="Modal input" value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
};

const Harness = () => {
  const [counter, setCounter] = useState(0);
  return (
    <div>
      <button onClick={() => setCounter(counter + 1)}>Re-render parent</button>
      <ModalController>
        {({ showModal, hideModal }) => (
          <button onClick={() => showModal(TestModal, { onDismiss: hideModal })}>Open modal</button>
        )}
      </ModalController>
    </div>
  );
};

describe('ModalController', () => {
  it('shows the modal when showModal is called', () => {
    render(<Harness />);
    expect(screen.queryByText('Test modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(screen.getByText('Test modal')).toBeInTheDocument();
  });

  it('keeps the modal state across parent re-renders', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open modal' }));
    fireEvent.change(screen.getByLabelText('Modal input'), { target: { value: 'typed text' } });

    // Re-rendering the parent (e.g. a panel refresh) must not remount the modal
    fireEvent.click(screen.getByRole('button', { name: 'Re-render parent' }));

    expect(screen.getByText('Test modal')).toBeInTheDocument();
    expect(screen.getByLabelText('Modal input')).toHaveValue('typed text');
  });
});
