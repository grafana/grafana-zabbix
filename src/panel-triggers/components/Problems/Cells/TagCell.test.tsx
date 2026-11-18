import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TagCell } from './TagCell';

const dataSource = { type: 'alexanderzobnin-zabbix-datasource', uid: 'ds-1' };

describe('TagCell', () => {
  it('renders one chip per tag as "tag: value"', () => {
    const tags = [
      { tag: 'scope', value: 'availability' },
      { tag: 'component', value: 'patroni' },
      { tag: 'flag', value: '' },
    ];
    render(<TagCell tags={tags} dataSource={dataSource} handleTagClick={jest.fn()} />);

    expect(screen.getByText('scope: availability')).toBeInTheDocument();
    expect(screen.getByText('component: patroni')).toBeInTheDocument();
    expect(screen.getByText('flag')).toBeInTheDocument();
  });

  it('renders nothing without tags', () => {
    const { container } = render(<TagCell tags={[]} dataSource={dataSource} handleTagClick={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('passes the tag, datasource and modifier keys to the click handler', () => {
    const onClick = jest.fn();
    const tag = { tag: 'scope', value: 'availability' };
    render(<TagCell tags={[tag]} dataSource={dataSource} handleTagClick={onClick} />);

    fireEvent.click(screen.getByText('scope: availability'));
    expect(onClick).toHaveBeenLastCalledWith(tag, dataSource, false, false);

    fireEvent.click(screen.getByText('scope: availability'), { ctrlKey: true });
    expect(onClick).toHaveBeenLastCalledWith(tag, dataSource, true, false);

    fireEvent.click(screen.getByText('scope: availability'), { shiftKey: true });
    expect(onClick).toHaveBeenLastCalledWith(tag, dataSource, false, true);
  });
});
