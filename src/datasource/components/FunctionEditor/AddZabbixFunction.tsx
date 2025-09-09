import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import React, { ReactNode, useMemo } from 'react';
import { getCategories } from '../../metricFunctions';
import { FuncDef } from '../../types/query';

type Props = {
  onFuncAdd: (def: FuncDef) => void;
};

export function AddZabbixFunction({ onFuncAdd }: Props) {
  const styles = useStyles2(getStyles);
  const menuItems = useMemo(() => buildMenuItems(onFuncAdd), [onFuncAdd]);

  const menuOverlay = useMemo(() => <Menu role="menu">{menuItems}</Menu>, [menuItems]);

  return (
    <Dropdown overlay={menuOverlay}>
      <Button icon="plus" variant="secondary" className={cx(styles.button)} aria-label="Add new function" />
    </Dropdown>
  );
}

function buildMenuItems(onClick: (func: FuncDef) => void) {
  const categories = getCategories();
  const menuItems: ReactNode[] = [];
  for (const categoryName in categories) {
    const functions = categories[categoryName];
    const subItems = functions.map((f) => <Menu.Item label={f.name} key={f.name} onClick={() => onClick(f)} />);
    menuItems.push(<Menu.Item label={categoryName} key={categoryName} childItems={subItems} />);
  }
  return menuItems;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css`
      margin-right: ${theme.spacing(0.5)};
    `,
  };
}
