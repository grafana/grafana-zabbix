import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import { ZBXGroup } from '../../../datasource/types';
import { getMetaRowStyles } from './detailsStyles';

interface ProblemGroupsProps {
  groups: ZBXGroup[];
}

export const ProblemGroups = ({ groups }: ProblemGroupsProps) => {
  const styles = useStyles2(getMetaRowStyles);
  return (
    <>
      {groups.map((g) => (
        <div className={styles.row} key={g.groupid} title={g.name}>
          <Icon name="folder" size="sm" className={styles.icon} />
          <span className={styles.text}>{g.name}</span>
        </div>
      ))}
    </>
  );
};
