import { uniqBy } from 'lodash';
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
  const uniqueHostTags = uniqBy(hostTags, (tag) => tag.tag);
  return uniqueHostTags;
}

/**
 * Get the label for a host tag option
 * Zabbix changed some of the operator labels in version 7.0.0 but the value equivalents remained the same.
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

/**
 * Matches a value against an item pattern following the plugin-wide filter convention:
 * a value wrapped in slashes ("/.../") is a regex, anything else must match exactly.
 * Used to scope suggestion dropdowns, so it errs on the permissive side: an empty pattern,
 * an unresolved template variable, or an invalid regex do not restrict anything.
 */
export function matchesItemPattern(value: string, pattern: string): boolean {
  if (!pattern || pattern.includes('$')) {
    return true;
  }
  if (pattern.length > 1 && pattern.startsWith('/') && pattern.endsWith('/')) {
    try {
      return new RegExp(pattern.slice(1, -1)).test(value);
    } catch {
      return true;
    }
  }
  return value === pattern;
}
