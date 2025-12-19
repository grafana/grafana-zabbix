import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { ITEM_COUNT_WARNING_THRESHOLD } from '../constants';

interface ItemCountWarningProps {
  itemCount: number;
  threshold?: number;
}

/**
 * A warning banner that displays when the query matches too many items.
 * This is a non-intrusive warning that doesn't block the query flow.
 */
export const ItemCountWarning: React.FC<ItemCountWarningProps> = ({
  itemCount,
  threshold = ITEM_COUNT_WARNING_THRESHOLD,
}) => {
  const styles = useStyles2(getStyles);

  if (itemCount < threshold) {
    return null;
  }

  return (
    <div className={styles.warningContainer}>
      <Icon name="exclamation-triangle" className={styles.icon} />
      <span className={styles.text}>
        Large number of items ({itemCount}): This query matches many items and may return a large amount of data.
        Consider using more specific filters.
      </span>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  warningContainer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    backgroundColor: theme.colors.warning.transparent,
    borderRadius: theme.shape.radius.default,
    marginBottom: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  icon: css({
    color: theme.colors.warning.text,
    flexShrink: 0,
  }),
  text: css({
    color: theme.colors.warning.text,
  }),
});

