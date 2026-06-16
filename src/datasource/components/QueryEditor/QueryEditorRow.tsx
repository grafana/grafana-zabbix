import React from 'react';
import { InlineFieldRow, InlineFormLabel } from '@grafana/ui';
import { css } from '@emotion/css';

export const QueryEditorRow = ({ children }: React.PropsWithChildren<{}>) => {
  const styles = getStyles();

  return (
    <InlineFieldRow>
      {children}
      <InlineFormLabel className={styles.rowTerminator}>
        <></>
      </InlineFormLabel>
    </InlineFieldRow>
  );
};

const getStyles = () => {
  return {
    rowTerminator: css({
      flexGrow: 1,
    }),
  };
};
