import React from 'react';
import { css } from '@emotion/css';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { expandItemName } from '../../../datasource/utils';
import { ZBXItem } from '../../../datasource/types';

interface ProblemItemsProps {
  items: ZBXItem[];
}

export const ProblemItems = ({ items }: ProblemItemsProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.items}>
      {items.length > 1 ? (
        items.map((item) => <ProblemItem item={item} key={item.itemid} showName={true} />)
      ) : (
        <ProblemItem item={items[0]} />
      )}
    </div>
  );
};

interface ProblemItemProps {
  item: ZBXItem;
  showName?: boolean;
}

const ProblemItem = ({ item, showName }: ProblemItemProps) => {
  const styles = useStyles2(getStyles);
  const itemName = expandItemName(item.name, item.key_);
  const tooltipContent = () => (
    <>
      {itemName}
      <br />
      {item.lastvalue}
    </>
  );

  return (
    <div className={styles.item}>
      <Icon name="chart-line" size="sm" className={styles.icon} />
      {showName && <span className={styles.itemName}>{item.name}:&nbsp;</span>}
      <Tooltip placement="top-start" content={tooltipContent}>
        <span className={styles.value}>{item.lastvalue}</span>
      </Tooltip>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  items: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    minWidth: 0,
  }),
  item: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
  }),
  icon: css({
    color: theme.colors.text.disabled,
    flexShrink: 0,
  }),
  itemName: css({
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
  }),
  value: css({
    fontWeight: theme.typography.fontWeightMedium,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
