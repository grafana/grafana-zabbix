import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { FAIcon } from '../../../components';
import { ZBXHost } from '../../../datasource/types';

interface ProblemHostsProps {
  hosts: ZBXHost[];
  className?: string;
}

export const ProblemHosts = ({ hosts }: ProblemHostsProps) => {
  const styles = useStyles2(getStyles);
  return (
    <>
      {hosts.map((h) => (
        <div className={styles.hostContainer} key={h.hostid}>
          <FAIcon icon="server" />
          <span>{h.name}</span>
        </div>
      ))}
    </>
  );
};

export const ProblemHostsDescription = ({ hosts }: ProblemHostsProps) => {
  const styles = useStyles2(getStyles);
  return (
    <>
      <span className={styles.label}>Host Description:&nbsp;</span>
      {hosts.map((h, i) => (
        <span key={`${h.hostid}-${i}`}>{h.description}</span>
      ))}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  hostContainer: css`
    margin-bottom: ${theme.spacing(0.2)};
  `,
  label: css`
    color: ${theme.colors.text.secondary};
  `,
});
