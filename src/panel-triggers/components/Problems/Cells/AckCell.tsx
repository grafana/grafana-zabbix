import React from 'react';
import { css } from '@emotion/css';
import { ZBXAcknowledge } from '../../../../datasource/types';
import { FAIcon } from '../../../../components';
import { useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    countLabel: css`
      font-size: ${theme.typography.fontSize};
    `,
  };
};

export const AckCell = (props: { acknowledges?: ZBXAcknowledge[] }) => {
  const acknowledges = props.acknowledges || [];
  const styles = getStyles(useTheme2());

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
