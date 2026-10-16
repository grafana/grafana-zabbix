import { uniqBy } from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';
import { ComboboxOption } from '@grafana/ui';
import { Host, Tag } from 'datasource/zabbix/types';
import { HostTagFilter } from 'datasource/types/query';
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

export interface HostTagAutocompleteOptions {
  /** Tag names present across the given hosts. */
  tagOptions: Array<ComboboxOption<string>>;
  /** Tag name -> the unique non-empty values seen for that tag. */
  valueOptions: Record<string, Array<ComboboxOption<string>>>;
}

/**
 * Build the tag-name and tag-value autocomplete options for the host tag picker from a list of
 * hosts fetched with their tags. Shared by the panel query editor and the variable query editor.
 */
export function buildHostTagOptions(hosts: Host[]): HostTagAutocompleteOptions {
  const tagOptions = processHostTags(hosts ?? []).map((tag) => ({ value: tag.tag, label: tag.tag }));

  const valuesByTag = new Map<string, Set<string>>();
  for (const host of hosts ?? []) {
    for (const tag of host?.tags ?? []) {
      const value = (tag?.value ?? '').toString();
      if (!tag?.tag || !value) {
        continue;
      }
      if (!valuesByTag.has(tag.tag)) {
        valuesByTag.set(tag.tag, new Set());
      }
      valuesByTag.get(tag.tag).add(value);
    }
  }

  const valueOptions: Record<string, Array<ComboboxOption<string>>> = {};
  for (const [tag, values] of valuesByTag.entries()) {
    valueOptions[tag] = Array.from(values)
      .sort()
      .map((value) => ({ value, label: value }));
  }

  return { tagOptions, valueOptions };
}

/**
 * Field-wise comparison of two host tag filter lists. Compares the fields rather than the object
 * references so callers stay correct regardless of whether the producer reuses filter objects
 * between renders.
 */
export function hostTagFiltersEqual(a: HostTagFilter[] = [], b: HostTagFilter[] = []): boolean {
  return (
    a.length === b.length &&
    a.every((filter, i) => filter.tag === b[i].tag && filter.value === b[i].value && filter.operator === b[i].operator)
  );
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
