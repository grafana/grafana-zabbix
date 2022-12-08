import { getTemplateSrv } from '@grafana/runtime';

export const getVariableOptions = () => {
  const variables = getTemplateSrv()
    .getVariables()
    .filter((v) => {
      return v.type !== 'datasource' && v.type !== 'interval';
    });
  return variables?.map((v) => ({
    value: `$${v.name}`,
    label: `$${v.name}`,
  }));
};
