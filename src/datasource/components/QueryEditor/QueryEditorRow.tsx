import React from 'react';
import { InlineFieldRow } from '@grafana/ui';

export const QueryEditorRow = ({ children }: React.PropsWithChildren<{}>) => {
  return (
    <InlineFieldRow>
      {children}
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow" />
      </div>
    </InlineFieldRow>
  );
};
