import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { GrafanaTheme2 } from '@grafana/data';
import { Combobox, ComboboxOption, Icon, InlineField, InlineSwitch, Stack, useStyles2 } from '@grafana/ui';
import { MetricPicker } from '../../../components';
import * as c from '../../constants';
import { selectTriggers } from '../../problemAnnotations';
import { getVariableOptions } from './utils';
import { ZabbixDatasource } from '../../datasource';
import { useInterpolatedQuery } from '../../hooks/useInterpolatedQuery';
import { useAsyncFn } from '../../hooks/useAsyncFn';
import { ProblemAnnotationsOptions, ZabbixMetricsQuery } from '../../types/query';

const severityOptions: Array<ComboboxOption<number>> = c.TRIGGER_SEVERITY.map((s) => ({
  value: s.val,
  label: s.text,
}));

interface Props {
  query: ZabbixMetricsQuery;
  datasource: ZabbixDatasource;
  onChange: (query: ZabbixMetricsQuery) => void;
}

/**
 * Collapsible "Problem annotations" section of Metrics and Item ID queries: draws the
 * problems of the triggers that reference the queried items on this panel.
 */
export const ProblemAnnotationsEditor = ({ query, datasource, onChange }: Props) => {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);
  const settings: ProblemAnnotationsOptions = query.problemAnnotations ?? {};
  const enabled = settings.enabled ?? datasource.problemAnnotationsByDefault;
  const interpolatedQuery = useInterpolatedQuery(datasource, query);

  const update = (patch: Partial<ProblemAnnotationsOptions>) => {
    onChange({ ...query, problemAnnotations: { ...settings, ...patch } });
  };

  const [{ loading: triggersLoading, value: triggers }, fetchTriggers] = useAsyncFn(async () => {
    const itemids = await datasource.getProblemAnnotationItemIds(interpolatedQuery);
    return itemids.length ? await datasource.zabbix.getItemTriggers(itemids) : [];
  }, [interpolatedQuery]);

  // Same picker as the other metric filters: trigger names, `/regex/` and variables.
  const triggerOptions: Array<ComboboxOption<string>> = [
    ...getVariableOptions(),
    { value: '/.*/', label: '/.*/' },
    ..._.uniqBy(triggers ?? [], 'description').map((t) => ({
      value: t.description,
      label: t.description,
      description: t.hosts?.map((h) => h.name).join(', '),
    })),
  ];

  const triggerFilter = settings.triggerFilter ?? '';
  // Count against the interpolated filter so `$var` previews what will be used
  const interpolatedTriggerFilter = interpolatedQuery.problemAnnotations?.triggerFilter ?? '';
  let matchedCount: number | undefined;
  try {
    matchedCount = triggers ? selectTriggers(triggers, { triggerFilter: interpolatedTriggerFilter }).length : undefined;
  } catch {
    // Invalid regex while typing
    matchedCount = undefined;
  }

  const itemFilterKey = [
    interpolatedQuery.group?.filter,
    interpolatedQuery.host?.filter,
    interpolatedQuery.itemTag?.filter,
    interpolatedQuery.item?.filter,
    interpolatedQuery.itemids,
  ].join('|');

  useEffect(() => {
    if (isOpen && enabled) {
      fetchTriggers();
    }
  }, [isOpen, enabled, itemFilterKey]);

  const summary = enabled
    ? [
        triggerFilter ? `triggers ${triggerFilter}` : 'all item triggers',
        settings.minSeverity ? `severity ≥ ${c.TRIGGER_SEVERITY[settings.minSeverity]?.text}` : '',
        settings.hideAcknowledged ? 'unacknowledged' : '',
      ]
        .filter(Boolean)
        .join(', ')
    : 'off';

  return (
    <>
      <div
        className={styles.header}
        role="button"
        aria-expanded={isOpen}
        aria-label="Problem annotations"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Stack alignItems="center">
          <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
          <span className={styles.label}>Problem annotations</span>
          <span className={styles.summary}>{summary}</span>
        </Stack>
      </div>
      {isOpen && (
        <div className={styles.body}>
          <InlineField
            label="Show problems"
            labelWidth={24}
            tooltip="Annotate this panel with the problems of the triggers that use the queried items. Problems show as regions from start to recovery."
          >
            <InlineSwitch
              value={enabled}
              onChange={() => update({ enabled: !enabled })}
              aria-label="Show problems as annotations"
            />
          </InlineField>
          {enabled && (
            <>
              <InlineField
                label="Triggers"
                labelWidth={24}
                tooltip={
                  <>
                    Leave empty to use every trigger of the queried items. Pick one trigger name, or type a regular
                    expression: <code>/CPU|load/</code> for several triggers, <code>/^(?!.*memory).*$/i</code> to
                    exclude some. Template variables work as in the other filters.
                  </>
                }
              >
                <Stack alignItems="center" gap={1}>
                  <MetricPicker
                    width={48}
                    value={triggerFilter}
                    options={triggerOptions}
                    isLoading={triggersLoading}
                    onChange={(value) => update({ triggerFilter: value })}
                    placeholder="All triggers of these items"
                    createCustomValue
                    isClearable
                  />
                  {triggers && matchedCount !== undefined && (
                    <span className={styles.summary} data-testid="annotation-trigger-match-count">
                      {matchedCount} of {triggers.length} triggers
                    </span>
                  )}
                </Stack>
              </InlineField>
              <InlineField label="Min severity" labelWidth={24}>
                <Combobox<number>
                  width={24}
                  value={settings.minSeverity ?? 0}
                  options={severityOptions}
                  onChange={(option) => update({ minSeverity: option.value })}
                />
              </InlineField>
              <InlineField label="Hide acknowledged" labelWidth={24}>
                <InlineSwitch
                  value={settings.hideAcknowledged ?? false}
                  onChange={() => update({ hideAcknowledged: !settings.hideAcknowledged })}
                />
              </InlineField>
            </>
          )}
        </div>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    marginBottom: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)}`,
    height: theme.spacing(4),
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  }),
  label: css({
    color: theme.colors.info.text,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  summary: css({
    color: theme.colors.text.disabled,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  body: css({
    display: 'flex',
    flexDirection: 'column',
    marginLeft: theme.spacing(4),
  }),
});
