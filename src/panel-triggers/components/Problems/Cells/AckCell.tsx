import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { ZBXAcknowledge } from '../../../../datasource/types';

const getStyles = (theme: GrafanaTheme2) => ({
  cell: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  check: css({
    display: 'inline-flex',
    color: theme.colors.success.text,
  }),
});

export const AckCell = (props: { acknowledges?: ZBXAcknowledge[] }) => {
  const styles = useStyles2(getStyles);
  const count = props.acknowledges?.length ?? 0;

  // Unacknowledged problems show nothing rather than "No"
  if (count === 0) {
    return null;
  }

  const label = count === 1 ? 'Acknowledged (1 entry)' : `Acknowledged (${count} entries)`;

  return (
    <span className={styles.cell}>
      <Tooltip content={label} placement="top">
        <span className={styles.check} role="img" aria-label={label}>
          <Icon name="check" />
        </span>
      </Tooltip>
    </span>
  );
};
