import { DataSourceInstanceSettings } from '@grafana/data';
import { ZABBIX_DS_ID } from '../datasource/constants';
import { SeverityOverride } from '../datasource/types/config';
import { applySeverityOverrides, collectSeverityOverrides, resolveSeverity } from './severityOverrides';
import { DEFAULT_SEVERITY, TriggerSeverity } from './types';

const zabbixDs = (uid: string, name: string, severityOverrides?: SeverityOverride[]) =>
  ({
    uid,
    name,
    type: ZABBIX_DS_ID,
    jsonData: { severityOverrides },
  }) as unknown as DataSourceInstanceSettings;

const otherDs = { uid: 'prom', name: 'Prometheus', type: 'prometheus', jsonData: {} } as DataSourceInstanceSettings;

const registry: Record<string, DataSourceInstanceSettings> = {
  'zbx-a': zabbixDs('zbx-a', 'Zabbix A', [
    { priority: 4, name: 'Critical', color: 'rgb(200, 0, 0)' },
    { priority: 5, name: 'Outage' },
  ]),
  'zbx-b': zabbixDs('zbx-b', 'Zabbix B', [
    { priority: 4, name: 'Major' },
    { priority: 5, color: '#000000' },
    { priority: 2, name: '   ' },
  ]),
  'zbx-none': zabbixDs('zbx-none', 'Zabbix without overrides'),
  prom: otherDs,
};

const getInstanceSettings = (ref: any) => {
  const uid = typeof ref === 'string' ? ref : ref?.uid;
  return registry[uid];
};

const target = (uid?: string) => ({ refId: 'A', datasource: uid ? { uid, type: ZABBIX_DS_ID } : undefined });

describe('collectSeverityOverrides', () => {
  it('returns nothing when there are no targets', () => {
    expect(collectSeverityOverrides(undefined, getInstanceSettings)).toEqual({ overrides: [], datasourceNames: [] });
    expect(collectSeverityOverrides([], getInstanceSettings)).toEqual({ overrides: [], datasourceNames: [] });
  });

  it('skips targets without a data source, non-Zabbix data sources and data sources without overrides', () => {
    const result = collectSeverityOverrides(
      [target(), target('prom'), target('zbx-none'), target('missing')],
      getInstanceSettings
    );
    expect(result).toEqual({ overrides: [], datasourceNames: [] });
  });

  it('reads overrides from the Zabbix data source of the target', () => {
    const result = collectSeverityOverrides([target('zbx-a')], getInstanceSettings);
    expect(result.datasourceNames).toEqual(['Zabbix A']);
    expect(result.overrides).toEqual([
      { priority: 4, name: 'Critical', color: 'rgb(200, 0, 0)' },
      { priority: 5, name: 'Outage' },
    ]);
  });

  it('merges several data sources, first target wins per field, blank values are ignored', () => {
    const result = collectSeverityOverrides([target('zbx-b'), target('zbx-a'), target('zbx-b')], getInstanceSettings);
    expect(result.datasourceNames).toEqual(['Zabbix B', 'Zabbix A']);
    expect(result.overrides).toEqual([
      { priority: 4, name: 'Major', color: 'rgb(200, 0, 0)' },
      { priority: 5, name: 'Outage', color: '#000000' },
    ]);
  });

  it('accepts string data source references', () => {
    const result = collectSeverityOverrides([{ refId: 'A', datasource: 'zbx-a' } as any], getInstanceSettings);
    expect(result.datasourceNames).toEqual(['Zabbix A']);
  });
});

describe('applySeverityOverrides', () => {
  it('returns the panel severity untouched when there are no overrides', () => {
    const { severity, applied } = applySeverityOverrides(DEFAULT_SEVERITY, []);
    expect(severity).toBe(DEFAULT_SEVERITY);
    expect(applied).toEqual([]);
  });

  it('applies global name and color where the panel uses the defaults', () => {
    const { severity, applied } = applySeverityOverrides(DEFAULT_SEVERITY, [
      { priority: 4, name: 'Critical', color: 'rgb(200, 0, 0)' },
      { priority: 5, name: 'Outage' },
    ]);
    expect(severity[4]).toEqual({ priority: 4, severity: 'Critical', color: 'rgb(200, 0, 0)', show: true });
    expect(severity[5]).toEqual({ ...DEFAULT_SEVERITY[5], severity: 'Outage' });
    expect(severity[0]).toBe(DEFAULT_SEVERITY[0]);
    expect(applied).toEqual([
      { priority: 4, name: 'Critical', color: 'rgb(200, 0, 0)' },
      { priority: 5, name: 'Outage' },
    ]);
  });

  it('keeps names and colors that were customized in the panel', () => {
    const panelSeverity: TriggerSeverity[] = DEFAULT_SEVERITY.map((s) =>
      s.priority === 4 ? { ...s, severity: 'Panel high', show: false } : s
    );
    const { severity, applied } = applySeverityOverrides(panelSeverity, [
      { priority: 4, name: 'Critical', color: 'rgb(200, 0, 0)' },
    ]);
    // custom panel name is kept, default color is overridden, show flag comes from the panel
    expect(severity[4]).toEqual({ priority: 4, severity: 'Panel high', color: 'rgb(200, 0, 0)', show: false });
    expect(applied).toEqual([{ priority: 4, color: 'rgb(200, 0, 0)' }]);
  });

  it('reports nothing applied when the panel customized every overridden field', () => {
    const panelSeverity: TriggerSeverity[] = DEFAULT_SEVERITY.map((s) =>
      s.priority === 5 ? { ...s, severity: 'Custom', color: '#123456' } : s
    );
    const { severity, applied } = applySeverityOverrides(panelSeverity, [
      { priority: 5, name: 'Outage', color: '#000000' },
    ]);
    expect(severity[5]).toBe(panelSeverity[5]);
    expect(applied).toEqual([]);
  });

  it('does not mutate the panel severity', () => {
    const panelSeverity = DEFAULT_SEVERITY.map((s) => ({ ...s }));
    const snapshot = JSON.parse(JSON.stringify(panelSeverity));
    applySeverityOverrides(panelSeverity, [{ priority: 1, name: 'Info' }]);
    expect(panelSeverity).toEqual(snapshot);
  });
});

describe('resolveSeverity', () => {
  it('returns the effective severity and the applied overrides', () => {
    const result = resolveSeverity(DEFAULT_SEVERITY, [target('zbx-a')], getInstanceSettings);
    expect(result.severity[4].severity).toBe('Critical');
    expect(result.globalSeverityOverrides).toEqual({
      datasourceNames: ['Zabbix A'],
      applied: [
        { priority: 4, name: 'Critical', color: 'rgb(200, 0, 0)' },
        { priority: 5, name: 'Outage' },
      ],
    });
  });

  it('omits the override state when nothing applies', () => {
    const result = resolveSeverity(DEFAULT_SEVERITY, [target('zbx-none')], getInstanceSettings);
    expect(result.severity).toBe(DEFAULT_SEVERITY);
    expect(result.globalSeverityOverrides).toBeUndefined();
  });
});
