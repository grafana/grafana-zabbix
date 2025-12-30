import { useEffect, useMemo, useState } from 'react';
import { ScopedVars } from '@grafana/data';
import { ZabbixDatasource } from '../datasource';
import { ZabbixMetricsQuery } from '../types/query';

const EMPTY_SCOPED_VARS: ScopedVars = {};

export const useInterpolatedQuery = (
  datasource: ZabbixDatasource,
  query: ZabbixMetricsQuery,
  scopedVars?: ScopedVars
): ZabbixMetricsQuery => {
  const [interpolatedQuery, setInterpolatedQuery] = useState<ZabbixMetricsQuery>(query);
  const resolvedScopedVars = useMemo(() => scopedVars ?? EMPTY_SCOPED_VARS, [scopedVars]);

  useEffect(() => {
    const replacedQuery = datasource.interpolateVariablesInQueries([query], resolvedScopedVars)[0];
    setInterpolatedQuery(replacedQuery);
  }, [datasource, query, resolvedScopedVars]);

  return interpolatedQuery;
};
