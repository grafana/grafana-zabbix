import _ from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';
import { Host, Tag } from 'datasource/zabbix/types';

export const getVariableOptions = () => {
  const variables = getTemplateSrv()
    .getVariables()
    .filter((v) => {
      return v.type !== 'datasource' && v.type !== 'interval';
    });
  return variables?.map((v) => ({
    value: `$${v.name}`,
    label: `$${v.name}`,
  }));
};

export function processHostTags(hosts: Host[]): Tag[] {
  const hostTags = hosts.map((host) => host.tags || []).flat();
  // deduplicate tags
  const uniqueHostTags = _.uniqBy(hostTags, (tag) => `${tag.tag}:${tag.value}`);
  return uniqueHostTags;
}
