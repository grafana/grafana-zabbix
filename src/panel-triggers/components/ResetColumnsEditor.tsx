import React from 'react';
import { Button } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';

export const ResetColumnsEditor = ({ onChange }: StandardEditorProps<any>) => {
  return (
    <Button variant="secondary" onClick={() => onChange([])}>
      Reset columns
    </Button>
  );
};
