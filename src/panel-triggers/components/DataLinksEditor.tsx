import React from 'react';
import { DataLink } from '@grafana/data';
import { StandardEditorProps } from '@grafana/data';
import { Button, Input, InlineField, Switch } from '@grafana/ui';

export const DataLinksEditor = ({ value, onChange }: StandardEditorProps<DataLink[]>) => {
  const links: DataLink[] = Array.isArray(value) ? value : [];

  const update = (index: number, patch: Partial<DataLink>) => {
    const updated = links.map((l, i) => (i === index ? { ...l, ...patch } : l));
    onChange(updated);
  };

  const add = () => onChange([...links, { title: 'Link', url: '', targetBlank: true }]);
  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i));

  return (
    <div>
      {links.map((link, i) => (
        <div key={i} style={{ marginBottom: 12, padding: 8, border: '1px solid #555', borderRadius: 4 }}>
          <InlineField label="Title" labelWidth={8} grow>
            <Input value={link.title} onChange={(e) => update(i, { title: e.currentTarget.value })} />
          </InlineField>
          <InlineField label="URL" labelWidth={8} grow>
            <Input
              value={link.url}
              placeholder="${host}, ${triggerid}, ${eventid}, ${name}, ${severity}"
              onChange={(e) => update(i, { url: e.currentTarget.value })}
            />
          </InlineField>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 12, color: '#d8d9da' }}>Open in new tab</span>
              <Switch
                value={!!link.targetBlank}
                onChange={(e) => update(i, { targetBlank: e.currentTarget.checked })}
              />
            </div>
            <Button size="sm" variant="destructive" icon="trash-alt" onClick={() => remove(i)}>
              Remove
            </Button>
          </div>
        </div>
      ))}
      <Button variant="secondary" icon="plus" onClick={add}>
        Add link
      </Button>
    </div>
  );
};
