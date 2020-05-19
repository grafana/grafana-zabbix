import React from 'react';
import { css } from 'emotion';
import { RTCell } from '../../types';
import { ProblemDTO } from '../../../datasource-zabbix/types';
import { FAIcon } from '../../../components';
import { useTheme, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    countLabel: css`
      font-size: ${theme.typography.size.sm};
    `,
  };
});

export const AckCell: React.FC<RTCell<ProblemDTO>> = (props: RTCell<ProblemDTO>) => {
  const problem = props.original;
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div>
      {problem.acknowledges?.length > 0 &&
        <>
          <FAIcon icon="comments" />
          <span className={styles.countLabel}> ({problem.acknowledges?.length})</span>
        </>
      }
    </div>
  );
};

export default AckCell;
