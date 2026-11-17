import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ComboboxOption } from '@grafana/ui';
import { Combobox } from './Combobox';

// Grafana's Combobox, pressing Enter after typing "Metrics" while "Problems" (index 2) is
// selected: downshift selects filteredOptions[2], which does not exist, and calls
// onChange(undefined). Clicking an option calls onChange with that option.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Combobox: ({ onChange, isClearable }: any) => (
    <>
      <button onClick={() => onChange(undefined)}>enter on short filter</button>
      <button onClick={() => onChange({ label: 'Text', value: '2' })}>pick Text</button>
      {isClearable && <button onClick={() => onChange(null)}>clear</button>}
    </>
  ),
}));

const options: Array<ComboboxOption<string>> = [
  { label: 'Metrics', value: '0' },
  { label: 'Text', value: '2' },
  { label: 'Problems', value: '5' },
];

describe('Combobox', () => {
  it('ignores the undefined option sent on Enter, instead of crashing the handler', () => {
    const onValue = jest.fn();
    // Like the plugin's handlers, this one reads option.value without a check.
    render(<Combobox value="5" options={options} onChange={(option) => onValue(option.value)} />);

    fireEvent.click(screen.getByText('enter on short filter'));

    expect(onValue).not.toHaveBeenCalled();
  });

  it('passes a selected option through', () => {
    const onValue = jest.fn();
    render(<Combobox value="5" options={options} onChange={(option) => onValue(option.value)} />);

    fireEvent.click(screen.getByText('pick Text'));

    expect(onValue).toHaveBeenCalledWith('2');
  });

  it('passes null through when the combobox is clearable', () => {
    const onChange = jest.fn();
    render(<Combobox value="5" options={options} isClearable onChange={onChange} />);

    fireEvent.click(screen.getByText('clear'));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
