import React from 'react';
import { DataLink, StandardEditorProps, VariableOrigin, VariableSuggestion } from '@grafana/data';
import { DataLinksInlineEditor } from '@grafana/ui';

const problemFieldSuggestions: VariableSuggestion[] = [
  { value: 'host', label: 'host', documentation: 'Host name', origin: VariableOrigin.Field },
  { value: 'name', label: 'name', documentation: 'Problem name', origin: VariableOrigin.Field },
  { value: 'description', label: 'description', documentation: 'Trigger description', origin: VariableOrigin.Field },
  { value: 'severity', label: 'severity', documentation: 'Problem severity', origin: VariableOrigin.Field },
  { value: 'triggerid', label: 'triggerid', documentation: 'Trigger ID', origin: VariableOrigin.Field },
  { value: 'eventid', label: 'eventid', documentation: 'Event ID', origin: VariableOrigin.Field },
];

export const DataLinksEditor = ({ value, onChange, context }: StandardEditorProps<DataLink[]>) => {
  const getSuggestions = (): VariableSuggestion[] => [
    ...problemFieldSuggestions,
    ...(context.getSuggestions ? context.getSuggestions() : []),
  ];

  return (
    <DataLinksInlineEditor
      links={Array.isArray(value) ? value : []}
      onChange={onChange}
      data={context.data ?? []}
      getSuggestions={getSuggestions}
    />
  );
};
