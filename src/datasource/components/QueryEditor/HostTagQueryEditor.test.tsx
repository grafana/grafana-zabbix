import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HostTagQueryEditor } from './HostTagQueryEditor';
import { HostTagFilter, ZabbixTagEvalType } from '../../types/query';
import { HostTagOperatorValue } from './types';

const comboboxSpy = jest.fn();
const radioButtonGroupSpy = jest.fn();

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    getVariables: jest.fn(() => []),
  })),
}));

jest.mock('@grafana/ui', () => ({
  Combobox: (props: any) => {
    comboboxSpy(props);
    return <div />;
  },
  Input: (props: any) => <input data-testid="tag-value-input" defaultValue={props.value} onBlur={props.onBlur} />,
  Button: (props: any) => <button aria-label={props['aria-label']} onClick={props.onClick} />,
  Tooltip: ({ children }: any) => <>{children}</>,
  Stack: ({ children }: any) => <div>{children}</div>,
  RadioButtonGroup: (props: any) => {
    radioButtonGroupSpy(props);
    return <div />;
  },
}));

const defaultProps = {
  hostTagFilters: [] as HostTagFilter[],
  hostTagOptions: [],
  hostTagOptionsLoading: false,
  version: '7.0.0',
  evalTypeValue: ZabbixTagEvalType.AndOr,
  onHostTagFilterChange: jest.fn(),
  onHostTagEvalTypeChange: jest.fn(),
};

const tagFilter = (overrides: Partial<HostTagFilter> = {}): HostTagFilter => ({
  tag: 'environment',
  value: 'production',
  operator: HostTagOperatorValue.Contains,
  ...overrides,
});

describe('HostTagQueryEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays initial tags from props', () => {
    render(<HostTagQueryEditor {...defaultProps} hostTagFilters={[tagFilter()]} />);

    const tagCombobox = comboboxSpy.mock.calls.map((call) => call[0]).find((props) => props?.options !== undefined);
    expect(tagCombobox.value).toBe('environment');
  });

  it('fires onChange when a tag filter is added', () => {
    const onChange = jest.fn();
    render(<HostTagQueryEditor {...defaultProps} onHostTagFilterChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Add new host tag filter'));

    expect(onChange).toHaveBeenCalledWith([{ tag: '', value: '', operator: HostTagOperatorValue.Contains }]);
  });

  it('fires onChange when a tag filter is removed', () => {
    const onChange = jest.fn();
    const filters = [tagFilter(), tagFilter({ tag: 'service' })];
    render(<HostTagQueryEditor {...defaultProps} hostTagFilters={filters} onHostTagFilterChange={onChange} />);

    fireEvent.click(screen.getAllByLabelText('Remove host tag filter')[0]);

    expect(onChange).toHaveBeenCalledWith([tagFilter({ tag: 'service' })]);
  });

  it('fires onChange when tag name is updated', () => {
    const onChange = jest.fn();
    render(<HostTagQueryEditor {...defaultProps} hostTagFilters={[tagFilter()]} onHostTagFilterChange={onChange} />);

    const tagCombobox = comboboxSpy.mock.calls.map((call) => call[0]).find((props) => props?.options !== undefined);
    act(() => {
      tagCombobox.onChange({ value: 'application' });
    });

    expect(onChange).toHaveBeenCalledWith([tagFilter({ tag: 'application' })]);
  });

  it('fires onChange when tag value is committed on blur', () => {
    const onChange = jest.fn();
    render(<HostTagQueryEditor {...defaultProps} hostTagFilters={[tagFilter()]} onHostTagFilterChange={onChange} />);

    fireEvent.blur(screen.getByTestId('tag-value-input'), { target: { value: 'staging' } });

    expect(onChange).toHaveBeenCalledWith([tagFilter({ value: 'staging' })]);
  });

  it('fires onChange when operator is updated', () => {
    const onChange = jest.fn();
    render(<HostTagQueryEditor {...defaultProps} hostTagFilters={[tagFilter()]} onHostTagFilterChange={onChange} />);

    const operatorCombobox = comboboxSpy.mock.calls
      .map((call) => call[0])
      .find((props) => props?.options?.some((option: any) => option.label === 'Does not equal'));
    act(() => {
      operatorCombobox.onChange({ value: HostTagOperatorValue.DoesNotEqual });
    });

    expect(onChange).toHaveBeenCalledWith([tagFilter({ operator: HostTagOperatorValue.DoesNotEqual })]);
  });

  it('fires onHostTagEvalTypeChange when eval type is changed', () => {
    const onEvalTypeChange = jest.fn();
    render(
      <HostTagQueryEditor {...defaultProps} hostTagFilters={[tagFilter()]} onHostTagEvalTypeChange={onEvalTypeChange} />
    );

    act(() => {
      radioButtonGroupSpy.mock.calls[0][0].onChange(ZabbixTagEvalType.Or);
    });

    expect(onEvalTypeChange).toHaveBeenCalledWith(ZabbixTagEvalType.Or);
  });

  it('hides value input for Exists operator', () => {
    render(
      <HostTagQueryEditor {...defaultProps} hostTagFilters={[tagFilter({ operator: HostTagOperatorValue.Exists })]} />
    );

    expect(screen.queryByTestId('tag-value-input')).not.toBeInTheDocument();
  });

  it('hides value input for DoesNotExist operator', () => {
    render(
      <HostTagQueryEditor
        {...defaultProps}
        hostTagFilters={[tagFilter({ operator: HostTagOperatorValue.DoesNotExist })]}
      />
    );

    expect(screen.queryByTestId('tag-value-input')).not.toBeInTheDocument();
  });

  it('shows eval type switch only when there are filters', () => {
    const { unmount } = render(<HostTagQueryEditor {...defaultProps} hostTagFilters={[]} />);
    expect(radioButtonGroupSpy).not.toHaveBeenCalled();
    unmount();

    render(<HostTagQueryEditor {...defaultProps} hostTagFilters={[tagFilter()]} />);
    expect(radioButtonGroupSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        value: ZabbixTagEvalType.AndOr,
        options: [
          { label: 'AND/OR', value: ZabbixTagEvalType.AndOr },
          { label: 'OR', value: ZabbixTagEvalType.Or },
        ],
      })
    );
  });

  it('syncs state when initialFilters change externally', () => {
    const { rerender } = render(<HostTagQueryEditor {...defaultProps} hostTagFilters={[]} />);

    rerender(<HostTagQueryEditor {...defaultProps} hostTagFilters={[tagFilter()]} />);

    const tagCombobox = comboboxSpy.mock.calls.map((call) => call[0]).find((props) => props?.options !== undefined);
    expect(tagCombobox.value).toBe('environment');
  });
});
