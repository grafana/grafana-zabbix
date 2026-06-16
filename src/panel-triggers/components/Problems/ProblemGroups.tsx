import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { FAIcon } from '../../../components';
import { ZBXGroup } from '../../../datasource/types';

interface ProblemGroupsProps {
  groups: ZBXGroup[];
  className?: string;
}

export const ProblemGroups = ({ groups }: ProblemGroupsProps) => {
  const styles = useStyles2(getStyles);
  return (
    <>
      {groups.map((g) => (
        <div className={styles.groupContainer} key={g.groupid}>
          <FAIcon icon="folder" />
          <span>{g.name}</span>
        </div>
      ))}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  groupContainer: css`
    margin-bottom: ${theme.spacing(0.2)};
  `,
});
