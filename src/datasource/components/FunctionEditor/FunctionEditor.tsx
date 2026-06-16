import { css } from '@emotion/css';
import React from 'react';
import { FunctionEditorControlsProps, FunctionEditorControls } from './FunctionEditorControls';

import { useStyles2, Tooltip } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { MetricFunc } from '../../types/query';

interface FunctionEditorProps extends FunctionEditorControlsProps {
  func: MetricFunc;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css`
      margin-right: ${theme.spacing(0.5)};
    `,
    label: css({
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize, // to match .gf-form-label
      cursor: 'pointer',
      display: 'inline-block',
    }),
  };
};

export const FunctionEditor: React.FC<FunctionEditorProps> = ({ onMoveLeft, onMoveRight, func, ...props }) => {
  const styles = useStyles2(getStyles);

  const renderContent = ({ updatePopperPosition }: any) => (
    <FunctionEditorControls
      {...props}
      func={func}
      onMoveLeft={() => {
        onMoveLeft(func);
        updatePopperPosition();
      }}
      onMoveRight={() => {
        onMoveRight(func);
        updatePopperPosition();
      }}
    />
  );

  return (
    <Tooltip content={renderContent} placement="top" interactive>
      <span className={styles.label}>{func.def.name}</span>
    </Tooltip>
  );
};
