import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { HostTagQueryEditor } from './HostTagQueryEditor';
import { HostTagOperatorValue } from './types';
import { HostTagFilter } from '../../types/query';

jest.mock('@grafana/ui', () => ({
  Button: (props: any) => <button {...props} />,
  Combobox: ({ value, onChange, options, ...rest }: any) => (
    <input
      value={value ?? ''}
      data-options={JSON.stringify(options ?? [])}
      onChange={(e) => onChange({ value: e.target.value })}
      {...rest}
    />
  ),
  RadioButtonGroup: (props: any) => <div {...props} />,
  Stack: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <>{children}</>,
}));

const renderEditor = (value: HostTagFilter[] | undefined, onHostTagFilterChange = jest.fn()) => {
  render(
    <HostTagQueryEditor
      hostTagOptions={[]}
      hostTagOptionsLoading={false}
      version="7.4.0"
      value={value}
      onHostTagFilterChange={onHostTagFilterChange}
      onHostTagEvalTypeChange={jest.fn()}
    />
  );
  return onHostTagFilterChange;
};

describe('HostTagQueryEditor', () => {
  it('renders the filters it is given', () => {
    renderEditor([{ tag: 'class', value: 'database', operator: HostTagOperatorValue.Equals }]);

    expect(screen.getByDisplayValue('class')).toBeInTheDocument();
    expect(screen.getByDisplayValue('database')).toBeInTheDocument();
  });

  it('does not write filters back on mount', () => {
    const onHostTagFilterChange = renderEditor(undefined);

    expect(onHostTagFilterChange).not.toHaveBeenCalled();
  });

  it('emits the appended filter when one is added', () => {
    const onHostTagFilterChange = renderEditor([
      { tag: 'class', value: 'database', operator: HostTagOperatorValue.Equals },
    ]);

    fireEvent.click(screen.getByLabelText('Add new host tag filter'));

    expect(onHostTagFilterChange).toHaveBeenCalledWith([
      { tag: 'class', value: 'database', operator: HostTagOperatorValue.Equals },
      { tag: '', value: '', operator: HostTagOperatorValue.Contains },
    ]);
  });

  it('emits the remaining filters when one is removed', () => {
    const onHostTagFilterChange = renderEditor([
      { tag: 'class', value: 'database', operator: HostTagOperatorValue.Equals },
      { tag: 'env', value: 'prod', operator: HostTagOperatorValue.Equals },
    ]);

    fireEvent.click(screen.getAllByLabelText('Remove host tag filter')[0]);

    expect(onHostTagFilterChange).toHaveBeenCalledWith([
      { tag: 'env', value: 'prod', operator: HostTagOperatorValue.Equals },
    ]);
  });

  it('picks up filters changed outside the editor', () => {
    const { rerender } = render(
      <HostTagQueryEditor
        hostTagOptions={[]}
        hostTagOptionsLoading={false}
        version="7.4.0"
        value={[{ tag: 'class', value: 'database', operator: HostTagOperatorValue.Equals }]}
        onHostTagFilterChange={jest.fn()}
        onHostTagEvalTypeChange={jest.fn()}
      />
    );

    rerender(
      <HostTagQueryEditor
        hostTagOptions={[]}
        hostTagOptionsLoading={false}
        version="7.4.0"
        value={[{ tag: 'env', value: 'prod', operator: HostTagOperatorValue.Equals }]}
        onHostTagFilterChange={jest.fn()}
        onHostTagEvalTypeChange={jest.fn()}
      />
    );

    expect(screen.getByDisplayValue('env')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('class')).not.toBeInTheDocument();
  });

  it('hides the value field for operators that take no value', () => {
    renderEditor([{ tag: 'class', value: '', operator: HostTagOperatorValue.Exists }]);

    expect(screen.getByDisplayValue('class')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Host tag value')).not.toBeInTheDocument();
  });
});
