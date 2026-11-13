import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import { ZBXHost } from '../../../datasource/types';
import { getMetaRowStyles } from './detailsStyles';

interface ProblemHostsProps {
  hosts: ZBXHost[];
}

export const ProblemHosts = ({ hosts }: ProblemHostsProps) => {
  const styles = useStyles2(getMetaRowStyles);
  return (
    <>
      {hosts.map((h) => (
        <div className={styles.row} key={h.hostid} title={h.name}>
          <Icon name="monitor" size="sm" className={styles.icon} />
          <span className={styles.text}>{h.name}</span>
        </div>
      ))}
    </>
  );
};
