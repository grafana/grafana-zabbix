import React from 'react';
import { css } from '@emotion/css';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { FAIcon } from '../../../components';
import { expandItemName } from '../../../datasource/utils';
import { ZBXItem } from '../../../datasource/types';

interface ProblemItemsProps {
  items: ZBXItem[];
}

export const ProblemItems = ({ items }: ProblemItemsProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.itemsRow}>
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
    <div className={styles.itemContainer}>
      <FAIcon icon="thermometer-three-quarters" />
      {showName && <span className={styles.itemName}>{item.name}:&nbsp;</span>}
      <Tooltip placement="top-start" content={tooltipContent}>
        <span>{item.lastvalue}</span>
      </Tooltip>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  itemContainer: css`
    display: flex;
  `,
  itemName: css`
    color: ${theme.colors.text.secondary};
  `,
  itemsRow: css`
    overflow: hidden;
  `,
});
