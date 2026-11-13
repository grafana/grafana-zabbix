import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { ZBXTag } from '../../../../datasource/types';
import { EventTag } from '../../EventTag';
import { em } from './cellStyles';

interface TagCellProps {
  tags?: ZBXTag[];
  dataSource: DataSourceRef;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  handleTagClick: (tag: ZBXTag, datasource?: DataSourceRef | string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Inline 20px chips on fixed 23px lines: at most two lines are shown and a third is hidden
  // whole rather than trimmed, and the block centres vertically in the 52px row.
  tags: css({
    display: 'block',
    whiteSpace: 'normal',
    lineHeight: em(theme, 23),
    maxHeight: em(theme, 46),
    overflow: 'hidden',
    '& > *': {
      marginRight: theme.spacing(0.5),
    },
  }),
});

export const TagCell = (props: TagCellProps) => {
  const { tags, dataSource, handleTagClick } = props;
  const styles = useStyles2(getStyles);

  if (!tags?.length) {
    return null;
  }

  return (
    <div className={styles.tags}>
      {tags.map((tag) => (
        <EventTag
          key={tag.tag + tag.value}
          variant="chip"
          tag={tag}
          datasource={dataSource}
          onClick={(clicked, datasource, ctrlKey, shiftKey) => handleTagClick?.(clicked, datasource, ctrlKey, shiftKey)}
        />
      ))}
    </div>
  );
};
