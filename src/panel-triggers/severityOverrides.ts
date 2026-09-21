import { DataSourceInstanceSettings } from '@grafana/data';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { ZABBIX_DS_ID } from '../datasource/constants';
import { SeverityOverride, ZabbixDSOptions } from '../datasource/types/config';
import { DEFAULT_SEVERITY, TriggerSeverity } from './types';

/**
 * Global severity override values that are actually in effect for a panel,
 * i.e. the data source value replaced the panel's default value.
 */
export interface AppliedSeverityOverride {
  priority: number;
  name?: string;
  color?: string;
}

export interface GlobalSeverityOverridesState {
  /** Names of the data sources the overrides were taken from */
  datasourceNames: string[];
  /** Per-priority global values that are in effect for this panel */
  applied: AppliedSeverityOverride[];
}

/** State shared between the Problems panel and its options editor via PanelContext */
export interface ProblemsPanelInstanceState {
  globalSeverityOverrides?: GlobalSeverityOverridesState;
}

type GetInstanceSettings = (
  ref?: DataSourceRef | string | null
) => DataSourceInstanceSettings<ZabbixDSOptions> | DataSourceInstanceSettings | undefined;

const hasValue = (value?: string): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * Collect severity overrides from the Zabbix data sources referenced by the panel targets.
 * Targets are visited in order and the first data source that defines a name or color for a
 * priority wins for that field.
 */
export function collectSeverityOverrides(
  targets: DataQuery[] | undefined,
  getInstanceSettings: GetInstanceSettings
): { overrides: SeverityOverride[]; datasourceNames: string[] } {
  const merged = new Map<number, SeverityOverride>();
  const datasourceNames: string[] = [];
  const visited = new Set<string>();

  for (const target of targets ?? []) {
    if (!target?.datasource) {
      continue;
    }
    let settings: DataSourceInstanceSettings | undefined;
    try {
      settings = getInstanceSettings(target.datasource);
    } catch {
      settings = undefined;
    }
    if (!settings || settings.type !== ZABBIX_DS_ID || visited.has(settings.uid)) {
      continue;
    }
    visited.add(settings.uid);

    const overrides = (settings.jsonData as ZabbixDSOptions | undefined)?.severityOverrides;
    if (!Array.isArray(overrides)) {
      continue;
    }

    let used = false;
    for (const override of overrides) {
      if (!override || typeof override.priority !== 'number') {
        continue;
      }
      const current = merged.get(override.priority) ?? { priority: override.priority };
      if (!hasValue(current.name) && hasValue(override.name)) {
        current.name = override.name;
        used = true;
      }
      if (!hasValue(current.color) && hasValue(override.color)) {
        current.color = override.color;
        used = true;
      }
      merged.set(override.priority, current);
    }
    if (used) {
      datasourceNames.push(settings.name);
    }
  }

  return {
    overrides: Array.from(merged.values())
      .filter((o) => hasValue(o.name) || hasValue(o.color))
      .sort((a, b) => a.priority - b.priority),
    datasourceNames,
  };
}

/**
 * Apply global overrides on top of the panel severity settings.
 * A global name or color is used only where the panel still has the plugin default value,
 * so dashboards saved with their own names or colors keep them. The `show` flag always
 * comes from the panel.
 */
export function applySeverityOverrides(
  panelSeverity: TriggerSeverity[],
  overrides: SeverityOverride[]
): { severity: TriggerSeverity[]; applied: AppliedSeverityOverride[] } {
  const applied: AppliedSeverityOverride[] = [];
  if (!overrides?.length) {
    return { severity: panelSeverity, applied };
  }

  const severity = panelSeverity.map((item) => {
    const override = overrides.find((o) => o.priority === item.priority);
    const defaults = DEFAULT_SEVERITY.find((d) => d.priority === item.priority);
    if (!override || !defaults) {
      return item;
    }

    const result = { ...item };
    const appliedItem: AppliedSeverityOverride = { priority: item.priority };
    let changed = false;

    if (hasValue(override.name) && item.severity === defaults.severity) {
      result.severity = override.name;
      appliedItem.name = override.name;
      changed = true;
    }
    if (hasValue(override.color) && item.color === defaults.color) {
      result.color = override.color;
      appliedItem.color = override.color;
      changed = true;
    }

    if (changed) {
      applied.push(appliedItem);
      return result;
    }
    return item;
  });

  return { severity, applied };
}

/**
 * Resolve the effective severity settings for a panel given its targets.
 */
export function resolveSeverity(
  panelSeverity: TriggerSeverity[],
  targets: DataQuery[] | undefined,
  getInstanceSettings: GetInstanceSettings
): { severity: TriggerSeverity[]; globalSeverityOverrides?: GlobalSeverityOverridesState } {
  const { overrides, datasourceNames } = collectSeverityOverrides(targets, getInstanceSettings);
  const { severity, applied } = applySeverityOverrides(panelSeverity, overrides);
  if (applied.length === 0) {
    return { severity };
  }
  return { severity, globalSeverityOverrides: { datasourceNames, applied } };
}
