import { useEffect, useState } from 'react';
import _ from 'lodash';
import { DataSourceRef } from '@grafana/schema';
import { getDataSourceInstanceSettings } from '@grafana/plugin-compat/datasources';

/** Data source names keyed by data source UID */
export type DataSourceNames = Record<string, string>;

/** Problems reference their data source either by ref or, in older versions, directly by name */
type ProblemDataSource = DataSourceRef | string | undefined;

const getDataSourceUIDs = (datasources: ProblemDataSource[]): string[] =>
  _.uniq(datasources.map((ds) => (ds as DataSourceRef)?.uid).filter((uid): uid is string => !!uid));

async function lookUpNames(uids: string[]): Promise<DataSourceNames> {
  const entries = await Promise.all(
    uids.map(async (uid) => [uid, (await getDataSourceInstanceSettings(uid))?.name ?? uid])
  );
  return Object.fromEntries(entries);
}

/**
 * Look up the names of the data sources problems come from.
 * Data sources that can't be found are named by their UID.
 */
export function getDataSourceNames(datasources: ProblemDataSource[]): Promise<DataSourceNames> {
  return lookUpNames(getDataSourceUIDs(datasources));
}

/** Name to display for a problem's data source. Empty while the name is still being looked up. */
export function getDataSourceName(datasource: ProblemDataSource, names: DataSourceNames): string {
  const uid = (datasource as DataSourceRef)?.uid;
  if (uid) {
    return names[uid] ?? '';
  }
  return (datasource as string) ?? '';
}

/** React hook wrapping {@link getDataSourceNames} */
export function useDataSourceNames(datasources: ProblemDataSource[]): DataSourceNames {
  const [names, setNames] = useState<DataSourceNames>({});
  const uids = getDataSourceUIDs(datasources);
  const uidsKey = JSON.stringify(uids);

  useEffect(() => {
    let active = true;
    lookUpNames(uids).then((resolved) => {
      if (active) {
        setNames(resolved);
      }
    });
    return () => {
      active = false;
    };
  }, [uidsKey]);

  return names;
}
