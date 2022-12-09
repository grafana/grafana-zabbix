import React, { FC } from 'react';
import { locationService } from '@grafana/runtime';
import { ExploreUrlState, TimeRange, urlUtil } from '@grafana/data';
import { MODE_ITEMID, MODE_METRICS } from '../../datasource/constants';
import { ActionButton } from '../ActionButton/ActionButton';
import { expandItemName } from '../../datasource/utils';
import { ProblemDTO } from '../../datasource/types';

interface Props {
  problem: ProblemDTO;
  range: TimeRange;
  panelId: number;
}

export const ExploreButton: FC<Props> = ({ problem, panelId, range }) => {
  return (
    <ActionButton icon="compass" width={6} onClick={() => openInExplore(problem, panelId, range)}>
      Explore
    </ActionButton>
  );
};

const openInExplore = (problem: ProblemDTO, panelId: number, range: TimeRange) => {
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
    const itemids = problem.items?.map((p) => p.itemid).join(',');
    query = {
      queryType: MODE_ITEMID,
      itemids: itemids,
    };
  }

  const state: ExploreUrlState | any = {
    datasource: problem.datasource,
    context: 'explore',
    originPanelId: panelId,
    range: range.raw,
    queries: [query],
  };

  const exploreState = JSON.stringify(state);
  const url = urlUtil.renderUrl('/explore', { left: exploreState });
  locationService.push(url);
};
