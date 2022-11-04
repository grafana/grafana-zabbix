import React from 'react';
import { swap } from '../../utils';
import { createFuncInstance } from '../../metricFunctions';
import { ZabbixDatasource } from '../../datasource';
import { FuncDef, MetricFunc, ZabbixMetricsQuery } from '../../types';
import { QueryEditorRow } from './QueryEditorRow';
import { InlineFormLabel } from '@grafana/ui';
import { ZabbixFunctionEditor } from '../FunctionEditor/ZabbixFunctionEditor';
import { AddZabbixFunction } from '../FunctionEditor/AddZabbixFunction';

export interface Props {
  query: ZabbixMetricsQuery;
  onChange: (query: ZabbixMetricsQuery) => void;
}

export const QueryFunctionsEditor = ({ query, onChange }: Props) => {
  const onFuncParamChange = (func: MetricFunc, index: number, value: string) => {
    func.params[index] = value;
    const funcIndex = query.functions.findIndex((f) => f === func);
    const functions = query.functions;
    functions[funcIndex] = func;
    onChange({ ...query, functions });
  };

  const onMoveFuncLeft = (func: MetricFunc) => {
    const index = query.functions.indexOf(func);
    const functions = swap(query.functions, index, index - 1);
    onChange({ ...query, functions });
  };

  const onMoveFuncRight = (func: MetricFunc) => {
    const index = query.functions.indexOf(func);
    const functions = swap(query.functions, index, index + 1);
    onChange({ ...query, functions });
  };

  const onRemoveFunc = (func: MetricFunc) => {
    const functions = query.functions?.filter((f) => f != func);
    onChange({ ...query, functions });
  };

  const onFuncAdd = (def: FuncDef) => {
    const newFunc = createFuncInstance(def);
    newFunc.added = true;
    let functions = query.functions.concat(newFunc);
    functions = moveAliasFuncLast(functions);

    // if ((newFunc.params.length && newFunc.added) || newFunc.def.params.length === 0) {
    // }
    onChange({ ...query, functions });
  };

  return (
    <QueryEditorRow>
      <InlineFormLabel width={6}>Functions</InlineFormLabel>
      {query.functions?.map((f, i) => {
        return (
          <ZabbixFunctionEditor
            func={f}
            key={i}
            onParamChange={onFuncParamChange}
            onMoveLeft={onMoveFuncLeft}
            onMoveRight={onMoveFuncRight}
            onRemove={onRemoveFunc}
          />
        );
      })}
      <AddZabbixFunction onFuncAdd={onFuncAdd} />
    </QueryEditorRow>
  );
};

function moveAliasFuncLast(functions: MetricFunc[]) {
  const aliasFuncIndex = functions.findIndex((func) => func.def.category === 'Alias');

  console.log(aliasFuncIndex);
  if (aliasFuncIndex >= 0) {
    const aliasFunc = functions[aliasFuncIndex];
    functions.splice(aliasFuncIndex, 1);
    functions.push(aliasFunc);
  }
  return functions;
}
