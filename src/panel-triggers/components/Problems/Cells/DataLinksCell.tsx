import React from 'react';
import { LinkModel } from '@grafana/data';
import { DataLinksContextMenu } from '@grafana/ui';

interface Props {
  links: LinkModel[];
}

export const DataLinksCell: React.FC<Props> = ({ links }) => {
  if (!links || links.length === 0) {
    return null;
  }

  // Single link — navigate directly, no menu
  if (links.length === 1) {
    return (
      <span style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <a
          href={links[0].href}
          target={links[0].target ?? '_blank'}
          rel="noopener noreferrer"
          title={links[0].title}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            background: '#3871dc',
            color: '#fff',
            borderRadius: 3,
            fontSize: 11,
            textDecoration: 'none',
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {links[0].title || '↗'}
        </a>
      </span>
    );
  }

  // Multiple links — Grafana native context menu
  return (
    <span style={{ display: 'flex', justifyContent: 'center' }}>
      <DataLinksContextMenu links={() => links}>
        {(api) => (
          <a
            onClick={(e) => { e.stopPropagation(); api.openMenu(e); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              background: '#3871dc',
              color: '#fff',
              borderRadius: 3,
              fontSize: 11,
              textDecoration: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Links ▾
          </a>
        )}
      </DataLinksContextMenu>
    </span>
  );
};
