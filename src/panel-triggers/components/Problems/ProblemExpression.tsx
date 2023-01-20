import React from 'react';
import { css } from '@emotion/css';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { ProblemDTO } from '../../../datasource/types';

interface Props {
  problem: ProblemDTO;
}

export const ProblemExpression = ({ problem }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <>
      <Tooltip placement="right" content={problem.expression}>
        <span className={styles.label}>Expression:&nbsp;</span>
      </Tooltip>
      <span className={styles.expression}>{problem.expression}</span>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
  `,
  expression: css`
    font-family: ${theme.typography.fontFamilyMonospace};
  `,
});
