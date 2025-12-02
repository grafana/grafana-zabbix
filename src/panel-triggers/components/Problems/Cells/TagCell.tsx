import { RTCell } from '../../../types';
import { ProblemDTO, ZBXTag } from '../../../../datasource/types';
import { DataSourceRef } from '@grafana/schema';
import React, { PureComponent } from 'react';
import { EventTag } from '../../EventTag';

interface TagCellProps extends RTCell<ProblemDTO> {
  onTagClick: (tag: ZBXTag, datasource: DataSourceRef | string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}

export const TagCellV8 = (props: {
  tags?: ZBXTag[];
  dataSource: DataSourceRef;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  handleTagClick: (tag: ZBXTag, datasource?: DataSourceRef | string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}) => {
  const { tags, dataSource, handleTagClick } = props;

  return (
    <div>
      {[
        (tags ?? []).map((tag) => (
          <EventTag
            key={tag.tag + tag.value}
            tag={tag}
            datasource={dataSource}
            onClick={() => handleTagClick?.(tag, dataSource)}
          />
        )),
      ]}
    </div>
  );
};

export class TagCell extends PureComponent<TagCellProps> {
  handleTagClick = (tag: ZBXTag, datasource: DataSourceRef | string, ctrlKey?: boolean, shiftKey?: boolean) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, datasource, ctrlKey, shiftKey);
    }
  };

  render() {
    const tags = this.props.value || [];
    return [
      tags.map((tag) => (
        <EventTag
          key={tag.tag + tag.value}
          tag={tag}
          datasource={this.props.original.datasource}
          onClick={this.handleTagClick}
        />
      )),
    ];
  }
}
