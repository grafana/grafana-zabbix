import React, { Fragment } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { ZBXAcknowledge } from '../../../datasource/types';

interface AcknowledgesListProps {
  acknowledges: ZBXAcknowledge[];
}

export default function AcknowledgesList(props: AcknowledgesListProps) {
  const { acknowledges } = props;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.list}>
      {acknowledges.map((ack) => (
        <Fragment key={ack.acknowledgeid}>
          <span className={styles.time}>{ack.time}</span>
          <span className={styles.user}>{formatUserName(ack)}</span>
          <span className={styles.message}>{formatAckMessage(ack)}</span>
        </Fragment>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    display: 'grid',
    gridTemplateColumns: 'max-content max-content minmax(0, 1fr)',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(0.5),
    alignItems: 'start',
    maxHeight: '12em',
    overflow: 'auto',
    paddingRight: theme.spacing(0.5),
  }),
  time: css({
    color: theme.colors.text.secondary,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }),
  user: css({
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
  }),
  message: css({
    // Long messages without spaces wrap instead of forcing a horizontal scrollbar
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-line',
  }),
});

function formatUserName(ack: ZBXAcknowledge): string {
  if (!ack.name && !ack.surname) {
    return ack.user;
  } else {
    return `${ack.name} ${ack.surname}`.trim();
  }
}

function formatAckMessage(ack: ZBXAcknowledge): string {
  let msg = '';
  let action = parseInt(ack.action, 10);

  if ((action & 2) !== 0) {
    msg = msg + '(Acknowledged) ';
  } else if ((action & 16) !== 0) {
    msg = msg + '(Unacknowledged) ';
  }

  if ((action & 32) !== 0) {
    msg = msg + '(Suppressed) ';
  } else if ((action & 64) !== 0) {
    msg = msg + '(Unsuppressed) ';
  }

  if ((action & 8) !== 0) {
    msg = msg + '(Changed severity) ';
  }

  msg = msg + ack.message;
  return msg.trim();
}
