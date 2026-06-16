import React from 'react';
import { Icon } from '@grafana/ui';
import { MetricFunc } from '../../types/query';

const DOCS_FUNC_REF_URL = 'https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/reference/functions/';

export interface FunctionEditorControlsProps {
  onMoveLeft: (func: MetricFunc) => void;
  onMoveRight: (func: MetricFunc) => void;
  onRemove: (func: MetricFunc) => void;
}

const FunctionHelpButton = (props: { description?: string; name: string }) => {
  return (
    <Icon
      className="pointer"
      name="question-circle"
      onClick={() => {
        window.open(`${DOCS_FUNC_REF_URL}#${props.name}`, '_blank');
      }}
    />
  );
};

export const FunctionEditorControls = (
  props: FunctionEditorControlsProps & {
    func: MetricFunc;
  }
) => {
  const { func, onMoveLeft, onMoveRight, onRemove } = props;
  return (
    <div
      style={{
        display: 'flex',
        width: '60px',
        justifyContent: 'space-between',
      }}
    >
      <Icon className="pointer" name="arrow-left" onClick={() => onMoveLeft(func)} />
      <FunctionHelpButton name={func.def.name} description={func.def.description} />
      <Icon className="pointer" name="times" onClick={() => onRemove(func)} />
      <Icon className="pointer" name="arrow-right" onClick={() => onMoveRight(func)} />
    </div>
  );
};
