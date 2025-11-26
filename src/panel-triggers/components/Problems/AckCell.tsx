import React from 'react';
import { css } from '@emotion/css';
import { RTCell } from '../../types';
import { ProblemDTO, ZBXAcknowledge } from '../../../datasource/types';
import { FAIcon } from '../../../components';
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    countLabel: css`
      font-size: ${theme.typography.size.sm};
    `,
  };
});

export const AckCellV8 = (props: { acknowledges?: ZBXAcknowledge[] }) => {
  const acknowledges = props.acknowledges || [];
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div>
      {acknowledges?.length > 0 && (
        <>
          <FAIcon icon="comments" />
          <span className={styles.countLabel}> ({acknowledges?.length})</span>
        </>
      )}
    </div>
  );
};

export const AckCell: React.FC<RTCell<ProblemDTO>> = (props: RTCell<ProblemDTO>) => {
  const problem = props.original;
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div>
      {problem.acknowledges?.length > 0 && (
        <>
          <FAIcon icon="comments" />
          <span className={styles.countLabel}> ({problem.acknowledges?.length})</span>
        </>
      )}
    </div>
  );
};

export default AckCell;
