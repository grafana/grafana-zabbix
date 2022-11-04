import React, { Suspense } from 'react';
import { Icon, Tooltip } from '@grafana/ui';
import { MetricFunc } from '../../types';

const DOCS_FUNC_REF_URL = 'https://alexanderzobnin.github.io/grafana-zabbix/reference/functions/';

export interface FunctionEditorControlsProps {
  onMoveLeft: (func: MetricFunc) => void;
  onMoveRight: (func: MetricFunc) => void;
  onRemove: (func: MetricFunc) => void;
}

const FunctionDescription = React.lazy(async () => {
  // @ts-ignore
  const { default: rst2html } = await import(/* webpackChunkName: "rst2html" */ 'rst2html');
  return {
    default(props: { description?: string }) {
      return <div dangerouslySetInnerHTML={{ __html: rst2html(props.description ?? '') }} />;
    },
  };
});

const FunctionHelpButton = (props: { description?: string; name: string }) => {
  if (props.description) {
    let tooltip = (
      <Suspense fallback={<span>Loading description...</span>}>
        <FunctionDescription description={props.description} />
      </Suspense>
    );
    return (
      <Tooltip content={tooltip} placement={'bottom-end'}>
        <Icon className={props.description ? undefined : 'pointer'} name="question-circle" />
      </Tooltip>
    );
  }

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
