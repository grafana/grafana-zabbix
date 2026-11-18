import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { em } from './cellStyles';

interface HostCellProps {
  name: string;
  /** Second line: host groups or technical name, shown when those columns are hidden */
  subtitle?: string;
  maintenance?: boolean;
}

const getStyles = (theme: GrafanaTheme2) => ({
  cell: css({
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    lineHeight: 1.3,
  }),
  name: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  nameText: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  subtitle: css({
    fontSize: em(theme, 11),
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  maintenance: css({
    display: 'inline-flex',
    flexShrink: 0,
    color: theme.colors.warning.text,
  }),
});

export const HostCell: React.FC<HostCellProps> = ({ name, subtitle, maintenance }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.cell}>
      <span className={styles.name}>
        <span className={styles.nameText} title={name} data-testid="host-name">
          {name}
        </span>
        {maintenance && (
          <Tooltip content="Host in maintenance" placement="top">
            <span className={styles.maintenance} aria-label="Host in maintenance">
              <Icon name="wrench" size="sm" />
            </span>
          </Tooltip>
        )}
      </span>
      {subtitle && (
        <span className={styles.subtitle} title={subtitle}>
          {subtitle}
        </span>
      )}
    </div>
  );
};
