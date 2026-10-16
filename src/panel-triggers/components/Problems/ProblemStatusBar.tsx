import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { ZBXAlert, ProblemDTO } from '../../../datasource/types';
import { em } from './Cells/cellStyles';

export interface ProblemStatusBarProps {
  problem: ProblemDTO;
  alerts?: ZBXAlert[];
}

interface Flag {
  icon: IconName;
  label: string;
  tooltip: string;
  active: boolean;
  link?: string;
}

/** Trigger flags that apply to this problem, as labelled chips. Inactive flags are not shown. */
export default function ProblemStatusBar({ problem, alerts }: ProblemStatusBarProps) {
  const styles = useStyles2(getStyles);

  const allFlags: Flag[] = [
    {
      icon: 'wrench',
      label: 'Maintenance',
      tooltip: 'Host in maintenance',
      active: !!(problem.maintenance || problem.hostInMaintenance),
    },
    { icon: 'external-link-alt', label: 'Link', tooltip: problem.url ?? '', active: !!problem.url, link: problem.url },
    {
      icon: 'bell',
      label: 'Multiple events',
      tooltip: 'Trigger generates multiple problem events',
      active: problem.type === '1',
    },
    {
      icon: 'tag-alt',
      label: 'Close by tag',
      tooltip: `OK event closes problems matched to tag: ${problem.correlation_tag}`,
      active: problem.correlation_mode === '1',
    },
    { icon: 'sync', label: 'Actions', tooltip: alerts?.[0]?.message ?? 'Actions executed', active: !!alerts?.length },
    {
      icon: 'question-circle',
      label: 'Unknown',
      tooltip: 'Current trigger state is unknown',
      active: problem.state === '1',
    },
    { icon: 'exclamation-triangle', label: 'Error', tooltip: problem.error ?? '', active: !!problem.error },
    {
      icon: 'times-circle',
      label: 'Manual close',
      tooltip: 'Problem can be closed manually',
      active: problem.manual_close === '1',
    },
  ];
  const flags = allFlags.filter((flag) => flag.active);

  if (flags.length === 0) {
    return null;
  }

  return (
    <div className={styles.bar}>
      {flags.map((flag) => {
        const chip = (
          <span className={styles.chip}>
            <Icon name={flag.icon} size="sm" />
            {flag.label}
          </span>
        );
        return (
          <Tooltip key={flag.label} content={flag.tooltip} placement="bottom">
            {flag.link ? (
              <a href={flag.link} target="_blank" rel="noreferrer" className={styles.link}>
                {chip}
              </a>
            ) : (
              chip
            )}
          </Tooltip>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  }),
  chip: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    height: em(theme, 22),
    padding: theme.spacing(0, 1),
    borderRadius: em(theme, 11),
    fontSize: em(theme, 11),
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    background: theme.colors.warning.transparent,
    color: theme.colors.warning.text,
    border: `1px solid ${theme.colors.warning.borderTransparent}`,
  }),
  link: css({
    display: 'inline-flex',
    '&:hover span': {
      background: theme.colors.warning.main,
      color: theme.colors.warning.contrastText,
    },
  }),
});
