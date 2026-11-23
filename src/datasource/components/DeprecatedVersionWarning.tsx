import React, { useEffect, useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { coerce, lt } from 'semver';

interface Props {
  datasourceUid: string;
}

const fetchZabbixVersion = async (datasourceUid: string): Promise<string | undefined> => {
  const { result } = await getBackendSrv().post<{ result?: unknown }>(
    `/api/datasources/uid/${datasourceUid}/resources/zabbix-api`,
    { method: 'apiinfo.version', params: {} },
    { showErrorAlert: false }
  );
  return typeof result === 'string' ? result : undefined;
};

const isBeforeZabbix60 = (version: string) => {
  const parsed = coerce(version);
  return parsed !== null && lt(parsed, '6.0.0');
};

/** Warns that plugin version 7.0 drops support for the saved data source's Zabbix server when it runs a version before 6.0. */
export const DeprecatedVersionWarning = ({ datasourceUid }: Props) => {
  const [version, setVersion] = useState<string>();

  useEffect(() => {
    fetchZabbixVersion(datasourceUid)
      .then(setVersion)
      .catch(() => setVersion(undefined));
  }, [datasourceUid]);

  if (!version || !isBeforeZabbix60(version)) {
    return null;
  }

  return (
    <Alert severity="warning" title={`Zabbix ${version} is not supported in plugin version 7.0`}>
      Version 7.0 of the Zabbix plugin supports Zabbix 6.0 and later, and removes the Application filter. Queries,
      template variables and annotations that use the Application filter can return different results. Upgrade Zabbix to
      version 6.0 or later before you upgrade the plugin to version 7.0.
    </Alert>
  );
};
