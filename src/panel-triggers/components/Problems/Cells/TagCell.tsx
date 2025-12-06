import { ZBXTag } from '../../../../datasource/types';
import { DataSourceRef } from '@grafana/schema';
import React from 'react';
import { EventTag } from '../../EventTag';

interface TagCellProps {
  tags?: ZBXTag[];
  dataSource: DataSourceRef;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  handleTagClick: (tag: ZBXTag, datasource?: DataSourceRef | string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}

export const TagCell = (props: TagCellProps) => {
  const { tags, dataSource, handleTagClick } = props;

  return [
    (tags ?? []).map((tag) => (
      <EventTag
        key={tag.tag + tag.value}
        tag={tag}
        datasource={dataSource}
        onClick={() => handleTagClick?.(tag, dataSource)}
      />
    )),
  ];
};
