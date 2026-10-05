import React from 'react';
import { css, cx } from '@emotion/css';
import { Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { colorManipulator, GrafanaTheme2 } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { ZBXTag } from '../../datasource/types';

const TAG_COLORS = [
  '#E24D42',
  '#1F78C1',
  '#BA43A9',
  '#705DA0',
  '#466803',
  '#508642',
  '#447EBC',
  '#C15C17',
  '#890F02',
  '#757575',
  '#0A437C',
  '#6D1F62',
  '#584477',
  '#629E51',
  '#2F4F4F',
  '#BF1B00',
  '#806EB7',
  '#8a2eb8',
  '#699e00',
  '#000000',
  '#3F6833',
  '#2F575E',
  '#99440A',
  '#E0752D',
  '#0E4AB4',
  '#58140C',
  '#052B51',
  '#511749',
  '#3F2B5B',
];

const TAG_BORDER_COLORS = [
  '#FF7368',
  '#459EE7',
  '#E069CF',
  '#9683C6',
  '#6C8E29',
  '#76AC68',
  '#6AA4E2',
  '#E7823D',
  '#AF3528',
  '#9B9B9B',
  '#3069A2',
  '#934588',
  '#7E6A9D',
  '#88C477',
  '#557575',
  '#E54126',
  '#A694DD',
  '#B054DE',
  '#8FC426',
  '#262626',
  '#658E59',
  '#557D84',
  '#BF6A30',
  '#FF9B53',
  '#3470DA',
  '#7E3A32',
  '#2B5177',
  '#773D6F',
  '#655181',
];

/**
 * Returns tag badge background and border colors based on hashed tag name.
 * @param name tag name
 */
export function getTagColorsFromName(name: string): { color: string; borderColor: string } {
  const hash = djb2(name.toLowerCase());
  const color = TAG_COLORS[Math.abs(hash % TAG_COLORS.length)];
  const borderColor = TAG_BORDER_COLORS[Math.abs(hash % TAG_BORDER_COLORS.length)];
  return { color, borderColor };
}

function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}

const URLPattern = /^https?:\/\/.+/;

interface Props {
  tag: ZBXTag;
  datasource: DataSourceRef | string;
  highlight?: boolean;
  onClick?: (tag: ZBXTag, datasource: DataSourceRef | string, ctrlKey?: boolean, shiftKey?: boolean) => void;
  /** 'chip' renders a theme-coloured chip (Problems table); default keeps the per-name colours */
  variant?: 'default' | 'chip';
}

export const EventTag = ({ tag, datasource, highlight, onClick, variant = 'default' }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const onClickInternal = (event) => {
    if (onClick) {
      onClick(tag, datasource, event.ctrlKey, event.shiftKey);
    }
  };

  const isChip = variant === 'chip';
  let style: React.CSSProperties;
  if (isChip) {
    // Chips are coloured by "name:value" so equal tags share a colour across rows: the lighter
    // shade carries the text on dark backgrounds, the darker one on light, over a 15% tint.
    const valueColor = getTagColorsFromName(tag.value ? `${tag.tag}:${tag.value}` : tag.tag);
    let accent = theme.isLight ? valueColor.color : valueColor.borderColor;
    // The palette spans very dark and very light shades; keep the accent readable on the theme background
    const luminance = colorManipulator.getLuminance(accent);
    if (!theme.isLight && luminance < 0.2) {
      accent = colorManipulator.lighten(accent, 0.45);
    } else if (theme.isLight && luminance > 0.12) {
      accent = colorManipulator.darken(accent, 0.35);
    }
    style = {
      color: accent,
      background: colorManipulator.alpha(accent, 0.15),
      borderColor: colorManipulator.alpha(accent, 0.5),
    };
  } else {
    const tagColor = getTagColorsFromName(tag.tag);
    style = {
      background: tagColor.color,
      borderColor: tagColor.borderColor,
    };
  }
  const className = isChip
    ? cx(styles.chip, { [styles.chipHighlighted]: highlight })
    : `label label-tag zbx-tag ${highlight ? 'highlighted' : ''}`;

  const isUrl = URLPattern.test(tag.value);
  const tagText = tag.value ? `${tag.tag}: ${tag.value}` : `${tag.tag}`;
  let tagElement = <>{tagText}</>;
  if (isUrl) {
    tagElement = (
      <Tooltip placement="top" content={tag.value}>
        <a href={tag.value} target="_blank" rel="noreferrer">
          <Icon name="link" className={styles.icon} />
          {tag.tag}
        </a>
      </Tooltip>
    );
  }

  return (
    // TODO: show tooltip when click feature is fixed
    // <Tooltip placement="bottom" content="Click to add tag filter or Ctrl/Shift+click to remove">
    <span className={className} style={style} onClick={onClickInternal} title={isChip ? tagText : undefined}>
      {tagElement}
    </span>
    // </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css`
    margin-right: ${theme.spacing(0.5)};
  `,
  chip: css({
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    maxWidth: '100%',
    // 20px tall at the 14px base; em here is relative to the chip's own 11px font
    height: `${20 / 11}em`,
    padding: theme.spacing(0, 0.75),
    borderRadius: 3,
    fontSize: `${11 / theme.typography.fontSize}em`,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    border: '1px solid transparent',
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
    '& a': {
      color: 'inherit',
    },
  }),
  chipHighlighted: css({
    boxShadow: `0 0 0 2px ${theme.colors.warning.border}`,
  }),
});
