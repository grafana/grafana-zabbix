import React, { FC } from 'react';
import { getLocationSrv } from '@grafana/runtime';
import { MODE_METRICS, MODE_ITEMID } from '../../datasource-zabbix/constants';
import { renderUrl } from '../../panel-triggers/utils';
import { expandItemName } from '../../datasource-zabbix/utils';
import { ProblemDTO } from '../../datasource-zabbix/types';
import { ActionButton } from '../ActionButton/ActionButton';

interface Props {
  problem: ProblemDTO;
  panelId: number;
}

export const ExploreButton: FC<Props> = ({ problem, panelId }) => {
  return (
    <ActionButton icon="compass" width={6} onClick={() => openInExplore(problem, panelId)}>
      Explore
    </ActionButton>
  );
};

const openInExplore = (problem: ProblemDTO, panelId: number) => {
  let query: any = {};

  if (problem.items?.length === 1 && problem.hosts?.length === 1) {
    const item = problem.items[0];
    const host = problem.hosts[0];
    const itemName = expandItemName(item.name, item.key_);
    query = {
      queryType: MODE_METRICS,
      group: { filter: '/.*/' },
      application: { filter: '' },
      host: { filter: host.name },
      item: { filter: itemName },
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
  getLocationSrv().update({ path: url, query: {} });
};
