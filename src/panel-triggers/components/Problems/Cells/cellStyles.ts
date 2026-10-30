import { GrafanaTheme2 } from '@grafana/data';

/**
 * Converts a mockup px size (drawn at the 14px base font) to em, so the cell scales with
 * the panel's font-size option, which sets a percentage on the table root.
 */
export const em = (theme: GrafanaTheme2, px: number) => `${px / theme.typography.fontSize}em`;
