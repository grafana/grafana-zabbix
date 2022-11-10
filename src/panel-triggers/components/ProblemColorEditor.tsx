import React, { FormEvent } from 'react';
import {
  Button,
  ColorPicker,
  HorizontalGroup,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  InlineSwitch,
  Input,
  VerticalGroup,
} from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';
import { GFHeartIcon } from '../../components';
import { TriggerSeverity } from '../types';

type Props = StandardEditorProps<TriggerSeverity[]>;
export const ProblemColorEditor = ({ value, onChange }: Props): JSX.Element => {
  const onSeverityItemChange = (severity: TriggerSeverity) => {
    value.forEach((v, i) => {
      if (v.priority === severity.priority) {
        value[i] = severity;
      }
    });
    onChange(value);
  };

  return (
    <>
      {value.map((severity) => (
        <ProblemColorEditorRow value={severity} onChange={(value) => onSeverityItemChange(value)} />
      ))}
    </>
  );
};

interface ProblemColorEditorRowProps {
  value: TriggerSeverity;
  onChange: (value?: TriggerSeverity) => void;
}

export const ProblemColorEditorRow = ({ value, onChange }: ProblemColorEditorRowProps): JSX.Element => {
  const onSeverityNameChange = (v: FormEvent<HTMLInputElement>) => {
    const newValue = v?.currentTarget?.value;
    if (newValue !== null) {
      onChange({ ...value, severity: newValue });
    }
  };

  return (
    <VerticalGroup>
      <InlineFieldRow>
        <InlineField labelWidth={12}>
          <Input width={24} defaultValue={value.severity} onBlur={onSeverityNameChange} />
        </InlineField>
        <InlineLabel width={4}>
          <ColorPicker color={value.color} onChange={(color) => onChange({ ...value, color })} />
        </InlineLabel>
        <InlineField label="Show">
          <InlineSwitch value={value.show} onChange={() => onChange({ ...value, show: !value.show })} />
        </InlineField>
      </InlineFieldRow>
    </VerticalGroup>
  );
};
