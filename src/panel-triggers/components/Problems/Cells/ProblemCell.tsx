import React from 'react';
import { css, cx } from '@emotion/css';
import { colorManipulator, GrafanaTheme2, LinkModel } from '@grafana/data';
import { DataLinksContextMenu, useStyles2 } from '@grafana/ui';
import { em } from './cellStyles';

interface ProblemCellProps {
  description: string;
  /** Operational data, shown as a monospace second line while the Operational data column is hidden */
  opdata?: string;
  /** Resolved panel data links; the description becomes the link like a native Grafana table cell */
  links?: LinkModel[];
}

const getStyles = (theme: GrafanaTheme2) => ({
  cell: css({
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    lineHeight: 1.3,
  }),
  description: css({
    color: theme.colors.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  link: css({
    color: theme.colors.text.link,
    textDecoration: 'underline',
    textDecorationColor: colorManipulator.alpha(theme.colors.text.link, 0.5),
    textUnderlineOffset: 2,
    cursor: 'pointer',
    '&:hover, &:focus-visible': {
      color: theme.colors.text.link,
      textDecorationColor: theme.colors.text.link,
    },
  }),
  opdata: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: em(theme, 11),
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});

export const ProblemCell: React.FC<ProblemCellProps> = ({ description, opdata, links }) => {
  const styles = useStyles2(getStyles);
  const descriptionClass = cx('problem-description', styles.description);

  let descriptionEl: React.ReactNode;
  if (!links?.length) {
    descriptionEl = (
      <span className={descriptionClass} title={description}>
        {description}
      </span>
    );
  } else if (links.length === 1) {
    // Single link: navigate directly
    const [link] = links;
    descriptionEl = (
      <a
        className={cx(descriptionClass, styles.link)}
        href={link.href}
        target={link.target ?? '_blank'}
        rel="noopener noreferrer"
        title={link.title || description}
        onClick={(e) => e.stopPropagation()}
      >
        {description}
      </a>
    );
  } else {
    // Several links: Grafana's own data links context menu
    descriptionEl = (
      <DataLinksContextMenu links={() => links}>
        {(api) => (
          <span
            role="link"
            tabIndex={0}
            className={cx(descriptionClass, styles.link)}
            title={description}
            onClick={(e) => {
              e.stopPropagation();
              api.openMenu(e);
            }}
          >
            {description}
          </span>
        )}
      </DataLinksContextMenu>
    );
  }

  return (
    <div className={styles.cell}>
      {descriptionEl}
      {opdata && (
        <span className={styles.opdata} title={opdata}>
          {opdata}
        </span>
      )}
    </div>
  );
};
