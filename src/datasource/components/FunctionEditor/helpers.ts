import { SelectableValue } from '@grafana/data';
import { MetricFunc } from '../../types';

export type ParamDef = {
  name: string;
  type: string;
  options?: Array<string | number>;
  multiple?: boolean;
  optional?: boolean;
  version?: string;
};

export type EditableParam = {
  name: string;
  value: string;
  optional: boolean;
  multiple: boolean;
  options: Array<SelectableValue<string>>;
};

function createEditableParam(paramDef: ParamDef, additional: boolean, value?: string | number): EditableParam {
  return {
    name: paramDef.name,
    value: value?.toString() || '',
    optional: !!paramDef.optional || additional, // only first param is required when multiple are allowed
    multiple: !!paramDef.multiple,
    options:
      paramDef.options?.map((option: string | number) => ({
        value: option.toString(),
        label: option.toString(),
      })) ?? [],
  };
}

/**
 * Create a list of params that can be edited in the function editor.
 */
export function mapFuncInstanceToParams(func: MetricFunc): EditableParam[] {
  // list of required parameters (from func.def)
  const params: EditableParam[] = func.def.params.map((paramDef: ParamDef, index: number) =>
    createEditableParam(paramDef, false, func.params[index])
  );

  // list of additional (multiple or optional) params entered by the user
  while (params.length < func.params.length) {
    const paramDef = func.def.params[func.def.params.length - 1];
    const value = func.params[params.length];
    params.push(createEditableParam(paramDef, true, value));
  }

  // extra "fake" param to allow adding more multiple values at the end
  if (params.length && params[params.length - 1].value && params[params.length - 1]?.multiple) {
    const paramDef = func.def.params[func.def.params.length - 1];
    params.push(createEditableParam(paramDef, true, ''));
  }

  return params;
}
