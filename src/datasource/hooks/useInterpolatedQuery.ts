import { useMemo } from 'react';
import { ScopedVars } from '@grafana/data';
import { ZabbixDatasource } from '../datasource';
import { ZabbixMetricsQuery } from '../types/query';

const EMPTY_SCOPED_VARS: ScopedVars = {};

export const useInterpolatedQuery = (
  datasource: ZabbixDatasource,
  query: ZabbixMetricsQuery,
  scopedVars?: ScopedVars
): ZabbixMetricsQuery => {
  const resolvedScopedVars = scopedVars ?? EMPTY_SCOPED_VARS;

  const interpolatedQuery = useMemo(() => {
    return datasource.interpolateVariablesInQueries([query], resolvedScopedVars)[0];
  }, [datasource, query, resolvedScopedVars]);

  return interpolatedQuery;
};
