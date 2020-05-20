import React, { FC } from 'react';
import { cx, css } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, GrafanaThemeType } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import { MODE_METRICS, MODE_ITEMID } from '../../datasource-zabbix/constants';
import { renderUrl } from '../../panel-triggers/utils';
import { FAIcon } from '../FAIcon/FAIcon';
import { ProblemDTO } from '../../datasource-zabbix/types';

interface Props {
  problem: ProblemDTO;
  panelId: number;
}

export const ExploreButton: FC<Props> = ({ problem, panelId }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const buttonClass = cx('btn', styles.button);

  return (
    <button className={buttonClass} onClick={() => openInExplore(problem, panelId)}>
      <FAIcon icon="compass" customClass={styles.icon} /><span>Explore</span>
    </button>
  );
};

const openInExplore = (problem: ProblemDTO, panelId: number) => {
  console.log(problem, panelId);
  let query: any = {};

  if (problem.items?.length === 1 && problem.hosts?.length === 1) {
    const item = problem.items[0];
    const host = problem.hosts[0];
    query = {
      queryType: MODE_METRICS,
      group: { filter: '/.*/' },
      application: { filter: '' },
      host: { filter: host.name },
      item: { filter: item.name },
    };
  } else {
    const itemids = problem.items?.map(p => p.itemid).join(',');
    query = {
      queryType: MODE_ITEMID,
      itemids: itemids,
    };
  }

  const state: any = {
    datasource: problem.datasource,
    context: 'explore',
    originPanelId: panelId,
    queries: [query],
  };

  const exploreState = JSON.stringify(state);
  const url = renderUrl('/explore', { left: exploreState });
  console.log(url);
  getLocationSrv().update({ path: url, query: {} });
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const actionBlue = theme.type === GrafanaThemeType.Light ? '#497dc0' : '#005f81';
  return {
    button: css`
      width: 6rem;
      height: 2rem;
      background-image: none;
      background-color: ${actionBlue};
      border: 1px solid darken(${actionBlue}, 6%);
      border-radius: 1px;
      margin-right: 1.6rem;

      i {
        vertical-align: middle;
      }

      &:hover {
        background-color: darken(${actionBlue}, 4%);
      }
    `,
    icon: css`
      i {
        color: ${theme.colors.text};
      }
    `,
  };
});
