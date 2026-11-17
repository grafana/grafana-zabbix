import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ItemTagEvalTypeSelect } from './ItemTagEvalTypeSelect';
import { ZabbixTagEvalType } from '../../types/query';

describe('ItemTagEvalTypeSelect', () => {
  it.each(['', 'component: cpu', '/^component/', '/a,b/'])('is hidden for filter %p', (tagFilter) => {
    const { container } = render(<ItemTagEvalTypeSelect tagFilter={tagFilter} onChange={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows OR by default for a tag list and emits AND/OR', () => {
    const onChange = jest.fn();
    render(<ItemTagEvalTypeSelect tagFilter="component: cpu, env: prod" onChange={onChange} />);

    expect(screen.getByRole('radio', { name: 'OR' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'AND/OR' }));
    expect(onChange).toHaveBeenCalledWith(ZabbixTagEvalType.AndOr);
  });
});
