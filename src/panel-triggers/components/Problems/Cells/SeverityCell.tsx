import React from 'react';
import _ from 'lodash';
import { css } from '@emotion/css';
import { colorManipulator, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { Cell } from '@tanstack/react-table';
import { SeverityStyle, TriggerSeverity } from '../../../types';
import { ProblemDTO } from '../../../../datasource/types';
import { DEFAULT_OK_COLOR } from '../constants';
import { em } from './cellStyles';

const getStyles = (theme: GrafanaTheme2) => ({
  // "Box": the severity colour fills the whole cell, as the panel always did
  box: css({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1.5),
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  // "Pill": a tinted badge with the colour as text
  pill: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: em(theme, 6),
    maxWidth: '100%',
    height: em(theme, 22),
    padding: `0 ${em(theme, 10)}`,
    borderRadius: em(theme, 12),
    fontSize: em(theme, 11),
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  }),
  dot: css({
    width: em(theme, 6),
    height: em(theme, 6),
    borderRadius: '50%',
    background: 'currentColor',
    flexShrink: 0,
  }),
  label: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});

export function SeverityCell(props: {
  cell: Cell<ProblemDTO, string>;
  problemSeverityDesc: TriggerSeverity[];
  markAckEvents?: boolean;
  ackEventColor?: string;
  okColor?: string;
  variant?: SeverityStyle;
}) {
  const {
    cell,
    problemSeverityDesc,
    markAckEvents,
    ackEventColor,
    okColor = DEFAULT_OK_COLOR,
    variant = 'box',
  } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { severity, acknowledged } = cell.row.original;

  const severityDesc = _.find(problemSeverityDesc, (s) => s.priority === Number(severity));
  const label = severityDesc?.severity ?? severity ?? '';

  // Colours come from the panel's severity options, not hard-coded Zabbix defaults
  let color = cell.getValue() === '0' ? okColor : (severityDesc?.color ?? theme.colors.text.secondary);
  if (markAckEvents && acknowledged === '1' && ackEventColor) {
    color = ackEventColor;
  }

  if (variant === 'box') {
    return (
      <div
        className={styles.box}
        style={{ background: color, color: theme.colors.getContrastText(color) }}
        title={label}
        data-testid="severity-box"
      >
        {label}
      </div>
    );
  }

  // Tinted background with the severity colour for text; darkened on light backgrounds for contrast
  const foreground = theme.isLight ? colorManipulator.darken(color, 0.25) : color;
  const background = colorManipulator.alpha(color, 0.15);

  return (
    <span className={styles.pill} style={{ color: foreground, background }} title={label}>
      <span className={styles.dot} />
      <span className={styles.label}>{label}</span>
    </span>
  );
}
