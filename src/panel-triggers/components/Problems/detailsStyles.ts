import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

/** Icon + text rows used by the expanded problem's meta column (datasource, proxy, groups, hosts) */
export const getMetaRowStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0,
  }),
  icon: css({
    color: theme.colors.text.disabled,
    flexShrink: 0,
  }),
  text: css({
    color: theme.colors.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
