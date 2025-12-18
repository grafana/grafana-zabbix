import _ from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';
import { Host, Tag } from 'datasource/zabbix/types';
import { HostTagOperatorLabel, HostTagOperatorLabelBefore70, HostTagOperatorValue } from './types';

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
  const uniqueHostTags = _.uniqBy(hostTags, (tag) => `${tag.tag}`);
  return uniqueHostTags;
}

/**
 * Get the label for a host tag option
 * Zabbix chaneged some of the operator labels in version 7.0.0 but the value equivalents remained the same.
 * this function helps fetch the right label value for those that are different.
 */
export function getHostTagOptionLabel(value: HostTagOperatorValue, version: string): string {
  switch (value) {
    case HostTagOperatorValue.DoesNotExist:
      return version < '7.0.0' ? HostTagOperatorLabelBefore70.NotExist : HostTagOperatorLabel.DoesNotExist;
    case HostTagOperatorValue.DoesNotEqual:
      return version < '7.0.0' ? HostTagOperatorLabelBefore70.NotEqual : HostTagOperatorLabel.DoesNotEqual;
    case HostTagOperatorValue.DoesNotContain:
      return version < '7.0.0' ? HostTagOperatorLabelBefore70.NotLike : HostTagOperatorLabel.DoesNotContain;
    default:
      return '';
  }
}
