import React, { PureComponent } from 'react';
import { ZBXTag } from '../types';
import { Tooltip } from '@grafana/ui';

interface EventTagProps {
  tag: ZBXTag;
  highlight?: boolean;
}

export default class TaskTag extends PureComponent<EventTagProps> {

  render() {
    const { tag, highlight } = this.props;
    const style: React.CSSProperties = {
      cursor: 'pointer',
    };
    return (
      <Tooltip placement="bottom" content={tag.value}>
      <span style={style} onClick={() => window.open(`${tag.tag.indexOf('jira_url') !== -1 ? `${tag.value}` : null}`)}>
        {tag.tag.indexOf('jira_url') !== -1 ? `${tag.value}`.split('/')[4] : null}
      </span>
      </Tooltip>
    );
  }
}


