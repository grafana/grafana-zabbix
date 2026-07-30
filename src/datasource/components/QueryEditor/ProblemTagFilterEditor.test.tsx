import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProblemTagFilterEditor } from './ProblemTagFilterEditor';
import { ProblemTagFilter, ZabbixTagEvalType } from '../../types/query';
import { TagOperatorValue } from './types';

const comboboxSpy = jest.fn();
const radioButtonGroupSpy = jest.fn();
const inputSpy = jest.fn();

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
  Input: (props: any) => {
    inputSpy(props);
    return <input data-testid="tag-value-input" defaultValue={props.value} onBlur={props.onBlur} />;
  },
  Button: (props: any) => <button aria-label={props['aria-label']} onClick={props.onClick} />,
  Tooltip: ({ children }: any) => <>{children}</>,
  Stack: ({ children }: any) => <div>{children}</div>,
  RadioButtonGroup: (props: any) => {
    radioButtonGroupSpy(props);
    return <div />;
  },
}));

const defaultProps = {
  tagFilters: [] as ProblemTagFilter[],
  version: '7.0.0',
  supportsExtendedOperators: true,
  evalType: ZabbixTagEvalType.AndOr,
  onChange: jest.fn(),
  onEvalTypeChange: jest.fn(),
};

const tagFilter = (overrides: Partial<ProblemTagFilter> = {}): ProblemTagFilter => ({
  tag: 'environment',
  value: 'production',
  operator: TagOperatorValue.Contains,
  ...overrides,
});

const findOperatorCombobox = () =>
  comboboxSpy.mock.calls
    .map((call) => call[0])
    .find((props) => props?.options?.some((option: any) => option.label === 'Contains'));

describe('ProblemTagFilterEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers all six operators when the Zabbix version supports them', () => {
    render(<ProblemTagFilterEditor {...defaultProps} tagFilters={[tagFilter()]} />);

    expect(findOperatorCombobox().options).toEqual([
      { value: TagOperatorValue.Exists, label: 'Exists' },
      { value: TagOperatorValue.Equals, label: 'Equals' },
      { value: TagOperatorValue.Contains, label: 'Contains' },
      { value: TagOperatorValue.DoesNotExist, label: 'Does not exist' },
      { value: TagOperatorValue.DoesNotEqual, label: 'Does not equal' },
      { value: TagOperatorValue.DoesNotContain, label: 'Does not contain' },
    ]);
  });

  it('only offers Equals and Contains on Zabbix < 5.4', () => {
    render(
      <ProblemTagFilterEditor
        {...defaultProps}
        version="5.0.0"
        supportsExtendedOperators={false}
        tagFilters={[tagFilter()]}
      />
    );

    expect(findOperatorCombobox().options).toEqual([
      { value: TagOperatorValue.Equals, label: 'Equals' },
      { value: TagOperatorValue.Contains, label: 'Contains' },
    ]);
  });

  it('uses pre-7.0 labels for negated operators on Zabbix < 7.0', () => {
    render(<ProblemTagFilterEditor {...defaultProps} version="6.4.0" tagFilters={[tagFilter()]} />);

    const labels = findOperatorCombobox().options.map((option: any) => option.label);
    expect(labels).toEqual(['Exists', 'Equals', 'Contains', 'Not exists', 'Not equal', 'Not like']);
  });

  it('adds a new filter with the default Contains operator', () => {
    const onChange = jest.fn();
    render(<ProblemTagFilterEditor {...defaultProps} tagFilters={[tagFilter()]} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Add new tag filter'));

    expect(onChange).toHaveBeenCalledWith([tagFilter(), { tag: '', value: '', operator: TagOperatorValue.Contains }]);
  });

  it('removes the selected filter', () => {
    const onChange = jest.fn();
    const filters = [tagFilter(), tagFilter({ tag: 'service' })];
    render(<ProblemTagFilterEditor {...defaultProps} tagFilters={filters} onChange={onChange} />);

    fireEvent.click(screen.getAllByLabelText('Remove tag filter')[0]);

    expect(onChange).toHaveBeenCalledWith([tagFilter({ tag: 'service' })]);
  });

  it('updates the operator of the edited filter', () => {
    const onChange = jest.fn();
    render(<ProblemTagFilterEditor {...defaultProps} tagFilters={[tagFilter()]} onChange={onChange} />);

    findOperatorCombobox().onChange({ value: TagOperatorValue.DoesNotEqual });

    expect(onChange).toHaveBeenCalledWith([tagFilter({ operator: TagOperatorValue.DoesNotEqual })]);
  });

  it('passes tag name suggestions to the tag combobox', () => {
    const tagOptions = [{ value: 'environment', label: 'environment' }];
    render(<ProblemTagFilterEditor {...defaultProps} tagFilters={[tagFilter()]} tagOptions={tagOptions} />);

    const tagCombobox = comboboxSpy.mock.calls.map((call) => call[0]).find((props) => props?.placeholder === 'Tag');
    expect(tagCombobox.options).toEqual(tagOptions);
    expect(tagCombobox.createCustomValue).toBe(true);
  });

  it('updates the tag name of the edited filter', () => {
    const onChange = jest.fn();
    render(<ProblemTagFilterEditor {...defaultProps} tagFilters={[tagFilter()]} onChange={onChange} />);

    const tagCombobox = comboboxSpy.mock.calls.map((call) => call[0]).find((props) => props?.placeholder === 'Tag');
    tagCombobox.onChange({ value: 'application' });

    expect(onChange).toHaveBeenCalledWith([tagFilter({ tag: 'application' })]);
  });

  it('commits the tag value on blur', () => {
    const onChange = jest.fn();
    render(<ProblemTagFilterEditor {...defaultProps} tagFilters={[tagFilter()]} onChange={onChange} />);

    fireEvent.blur(screen.getByTestId('tag-value-input'), { target: { value: 'staging' } });

    expect(onChange).toHaveBeenCalledWith([tagFilter({ value: 'staging' })]);
  });

  it.each([TagOperatorValue.Exists, TagOperatorValue.DoesNotExist])(
    'hides the value input for the %s operator',
    (operator) => {
      render(<ProblemTagFilterEditor {...defaultProps} tagFilters={[tagFilter({ operator })]} />);

      expect(inputSpy).not.toHaveBeenCalled();
    }
  );

  it('shows the eval type switch only when there are filters', () => {
    const { unmount } = render(<ProblemTagFilterEditor {...defaultProps} tagFilters={[]} />);
    expect(radioButtonGroupSpy).not.toHaveBeenCalled();
    unmount();

    render(<ProblemTagFilterEditor {...defaultProps} tagFilters={[tagFilter()]} />);
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

  it('propagates eval type changes', () => {
    const onEvalTypeChange = jest.fn();
    render(<ProblemTagFilterEditor {...defaultProps} tagFilters={[tagFilter()]} onEvalTypeChange={onEvalTypeChange} />);

    radioButtonGroupSpy.mock.calls[0][0].onChange(ZabbixTagEvalType.Or);

    expect(onEvalTypeChange).toHaveBeenCalledWith(ZabbixTagEvalType.Or);
  });
});
