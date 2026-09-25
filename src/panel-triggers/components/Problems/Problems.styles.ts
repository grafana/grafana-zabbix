import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

// Shared control height for toolbar and pagination widgets
const CONTROL_HEIGHT = 28;

// Values of the panel's "Font size" option other than 100%; each becomes a `.font-size--N` root class
const FONT_SIZE_OPTIONS = [80, 90, 110, 120, 130, 150, 160, 180, 200, 220, 250];

export const getStyles = (theme: GrafanaTheme2) => {
  // Mockup sizes are given in px for the 14px base font; expressing them in em lets the
  // font-size option scale the whole table.
  const em = (px: number, base: number = theme.typography.fontSize) => `${px / base}em`;
  const HEADER_FONT_PX = 11;

  const focusRing = {
    outline: 'none',
    borderColor: theme.colors.primary.border,
    boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0 4px ${theme.colors.primary.main}`,
  };

  const inputBase = {
    background: theme.components.input.background,
    color: theme.components.input.text,
    border: `1px solid ${theme.components.input.borderColor}`,
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1,
    '&:hover': {
      borderColor: theme.components.input.borderHover,
    },
    '&:focus': focusRing,
  };

  return {
    // Layout -----------------------------------------------------------------
    root: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontSize: theme.typography.fontSize,
      ...Object.fromEntries(FONT_SIZE_OPTIONS.map((size) => [`&.font-size--${size}`, { fontSize: `${size}%` }])),
    }),
    wrapper: css({
      position: 'relative',
      flex: '1 1 auto',
      minHeight: 90,
      overflow: 'auto',
    }),
    wrapperLoading: css({
      '& table': {
        opacity: 0.3,
        pointerEvents: 'none',
      },
    }),
    loadingOverlay: css({
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.text.secondary,
    }),

    // Table ------------------------------------------------------------------
    table: css({
      width: '100%',
      border: 'none',
      borderCollapse: 'separate',
      borderSpacing: 0,
      tableLayout: 'fixed',
    }),
    headerCell: css({
      position: 'relative',
      boxSizing: 'border-box',
      // em here is relative to the cell's own 11px font, not the table base
      height: em(36, HEADER_FONT_PX),
      padding: theme.spacing(0, 1.5),
      textAlign: 'left',
      verticalAlign: 'middle',
      background: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      color: theme.colors.text.secondary,
      fontSize: em(HEADER_FONT_PX),
      fontWeight: 600,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      userSelect: 'none',
      '&:first-of-type': {
        paddingLeft: theme.spacing(2),
      },
    }),
    headerButton: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      maxWidth: '100%',
      padding: 0,
      background: 'none',
      border: 'none',
      color: 'inherit',
      font: 'inherit',
      letterSpacing: 'inherit',
      textTransform: 'inherit',
      cursor: 'pointer',
      '&:hover': {
        color: theme.colors.text.primary,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: 2,
      },
      '&:hover [data-sort-hint], &:focus-visible [data-sort-hint]': {
        opacity: 0.5,
      },
    }),
    headerSorted: css({
      color: theme.colors.text.primary,
    }),
    // Faint chevron that only appears on hover, so unsorted columns still read as sortable
    sortHint: css({
      display: 'inline-flex',
      // Takes no layout space so it never truncates the label; overflows into the cell padding
      width: 0,
      overflow: 'visible',
      opacity: 0,
      transition: 'opacity 0.15s',
    }),
    headerLabel: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    resizer: css({
      position: 'absolute',
      top: 0,
      right: 0,
      height: '100%',
      width: 6,
      cursor: 'col-resize',
      userSelect: 'none',
      touchAction: 'none',
      zIndex: 1,
      '&::after': {
        content: '""',
        position: 'absolute',
        right: 2,
        top: '25%',
        height: '50%',
        width: 1,
        background: theme.colors.border.weak,
        transition: 'background 0.15s',
      },
      '&:hover::after': {
        background: theme.colors.primary.border,
      },
    }),
    resizerActive: css({
      '&::after': {
        background: theme.colors.primary.border,
      },
    }),

    // Column reordering ------------------------------------------------------
    // Drag handle before the header label; only visible while the pointer is over the header
    grip: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      verticalAlign: 'middle',
      width: em(14, HEADER_FONT_PX),
      height: em(20, HEADER_FONT_PX),
      marginRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.disabled,
      cursor: 'grab',
      opacity: 0,
      touchAction: 'none',
      transition: 'opacity 0.15s, color 0.15s',
      'th:hover > &': {
        opacity: 1,
      },
      '&:hover': {
        color: theme.colors.text.primary,
      },
      '&:active': {
        cursor: 'grabbing',
      },
    }),
    // Source column while its header is lifted
    headerDragging: css({
      opacity: 0.4,
    }),
    // 2px insertion line on the edge where the dragged column will land
    dropBefore: css({
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 2,
        background: theme.colors.primary.main,
        zIndex: 2,
      },
    }),
    dropAfter: css({
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: 2,
        background: theme.colors.primary.main,
        zIndex: 2,
      },
    }),
    // Lifted copy of the header that follows the pointer; positioned and sized from the source
    // cell. Lives in a body portal, so px instead of the table's em scale.
    dragOverlay: css({
      position: 'fixed',
      zIndex: theme.zIndex.tooltip,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      boxSizing: 'border-box',
      padding: theme.spacing(0, 1.5),
      background: theme.colors.background.secondary,
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      fontSize: HEADER_FONT_PX,
      fontWeight: 600,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      cursor: 'grabbing',
    }),
    row: css({
      '&:hover td': {
        background: theme.colors.action.hover,
      },
    }),
    bodyCell: css({
      boxSizing: 'border-box',
      height: em(52),
      padding: theme.spacing(0, 1.5),
      verticalAlign: 'middle',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      '&:first-of-type': {
        paddingLeft: theme.spacing(2),
      },
    }),
    expandedCell: css({
      padding: 0,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    expanderCell: css({
      padding: 0,
      textAlign: 'center',
    }),
    expander: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: em(28),
      height: em(28),
      padding: 0,
      background: 'none',
      border: 'none',
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.disabled,
      cursor: 'pointer',
      transition: 'transform 0.15s ease-out, color 0.15s',
      '&:hover': {
        color: theme.colors.text.primary,
        background: theme.colors.action.hover,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: -2,
      },
    }),
    expanderOpen: css({
      color: theme.colors.text.primary,
      transform: 'rotate(180deg)',
    }),
    // Rendered outside the table so it centres in the visible width, not the (wider) table
    noData: css({
      padding: theme.spacing(4, 0),
      textAlign: 'center',
      color: theme.colors.text.secondary,
    }),

    // Toolbar ----------------------------------------------------------------
    toolbar: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: theme.spacing(1.5),
      padding: theme.spacing(0.5, 0, 1),
    }),
    search: css({
      position: 'relative',
      width: 260,
      maxWidth: '100%',
      flexShrink: 0,
      marginLeft: 'auto',
    }),
    searchIcon: css({
      position: 'absolute',
      left: theme.spacing(1),
      top: '50%',
      transform: 'translateY(-50%)',
      color: theme.colors.text.secondary,
      pointerEvents: 'none',
    }),
    searchInput: css({
      ...inputBase,
      width: '100%',
      height: 32,
      padding: theme.spacing(0, 1, 0, 3.5),
      fontSize: theme.typography.body.fontSize,
      '&::placeholder': {
        color: theme.colors.text.disabled,
      },
    }),
    badges: css({
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    }),
    badge: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      height: 22,
      padding: theme.spacing(0, 1.25),
      borderRadius: 11,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
      background: theme.colors.background.secondary,
      color: theme.colors.text.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    badgeActive: css({
      background: theme.colors.error.transparent,
      color: theme.colors.error.text,
      borderColor: theme.colors.error.borderTransparent,
    }),
    badgeDot: css({
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor',
      flexShrink: 0,
    }),

    // Pagination -------------------------------------------------------------
    pagination: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginTop: 'auto',
      padding: theme.spacing(1, 0, 0),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    paginationRange: css({
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }),
    paginationControls: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    pageButton: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: CONTROL_HEIGHT,
      height: CONTROL_HEIGHT,
      padding: 0,
      background: theme.colors.background.primary,
      color: theme.colors.text.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      '&:hover:not(:disabled)': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
      '&:focus-visible': focusRing,
      '&:disabled': {
        color: theme.colors.text.disabled,
        cursor: 'not-allowed',
      },
    }),
    pageInfo: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      whiteSpace: 'nowrap',
      color: theme.colors.text.primary,
      fontVariantNumeric: 'tabular-nums',
    }),
    pageInput: css({
      ...inputBase,
      width: 44,
      height: CONTROL_HEIGHT,
      padding: theme.spacing(0, 0.5),
      textAlign: 'center',
      fontVariantNumeric: 'tabular-nums',
      MozAppearance: 'textfield',
      '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
        WebkitAppearance: 'none',
        margin: 0,
      },
    }),
    pageSize: css({
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
    }),
    pageSizeSelect: css({
      ...inputBase,
      // Grafana's global stylesheet gives bare selects a fixed 220px width and a 4px height
      width: 'auto',
      height: CONTROL_HEIGHT,
      padding: theme.spacing(0, 3, 0, 1),
      cursor: 'pointer',
      appearance: 'none',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      fontVariantNumeric: 'tabular-nums',
      '& option': {
        background: theme.components.input.background,
        color: theme.components.input.text,
      },
    }),
    pageSizeIcon: css({
      position: 'absolute',
      right: theme.spacing(1),
      top: '50%',
      transform: 'translateY(-50%)',
      color: theme.colors.text.secondary,
      pointerEvents: 'none',
    }),
  };
};
