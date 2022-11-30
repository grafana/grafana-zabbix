import React from 'react';
import { Button } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';

type Props = StandardEditorProps<any>;
export const ResetColumnsEditor = ({ onChange }: Props): JSX.Element => {
  return (
    <Button variant="secondary" onClick={() => onChange([])}>
      Reset columns
    </Button>
  );
};
