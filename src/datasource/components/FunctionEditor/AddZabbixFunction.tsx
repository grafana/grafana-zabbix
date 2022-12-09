import { css, cx } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, ClickOutsideWrapper, Icon, Input, Menu, useStyles2, useTheme2 } from '@grafana/ui';
import { FuncDef } from '../../types';
import { getCategories } from '../../metricFunctions';

// import { mapFuncDefsToSelectables } from './helpers';

type Props = {
  // funcDefs: MetricFunc;
  onFuncAdd: (def: FuncDef) => void;
};

export function AddZabbixFunction({ onFuncAdd }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const onFuncAddInternal = (def: FuncDef) => {
    onFuncAdd(def);
    setShowMenu(false);
  };

  const onSearch = (e: React.FormEvent<HTMLInputElement>) => {
    console.log(e.currentTarget.value);
  };

  const onClickOutside = () => {
    setShowMenu(false);
  };

  const menuItems = useMemo(() => buildMenuItems(onFuncAddInternal), [onFuncAdd]);

  return (
    <div>
      {!showMenu && (
        <Button
          icon="plus"
          variant="secondary"
          className={cx(styles.button)}
          aria-label="Add new function"
          onClick={() => setShowMenu(!showMenu)}
        />
      )}
      {showMenu && (
        <ClickOutsideWrapper onClick={onClickOutside} useCapture>
          <Input onChange={onSearch} suffix={<Icon name="search" />} />
          <Menu style={{ position: 'absolute', zIndex: theme.zIndex.dropdown }}>{menuItems}</Menu>
        </ClickOutsideWrapper>
      )}
    </div>
  );
}

function buildMenuItems(onClick: (func: FuncDef) => void) {
  const categories = getCategories();
  const menuItems: JSX.Element[] = [];
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
