import React, { useEffect, useMemo, useState } from 'react';
import { getDataSourceSrv, config, GetDataSourceListFilters } from '@grafana/runtime';
import {
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  GrafanaTheme2,
  SelectableValue,
} from '@grafana/data';
import {
  Alert,
  Badge,
  Box,
  CollapsableSection,
  Combobox,
  ComboboxOption,
  Field,
  Input,
  MultiSelect,
  SecretInput,
  SecureSocksProxySettings,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { ZabbixAuthType, ZabbixDSOptions, ZabbixSecureJSONData } from '../types/config';
import { gte } from 'semver';
import { ConfigSubSection, convertLegacyAuthProps, CustomHeadersSettings, TLSSettings } from '@grafana/plugin-ui';
import { css } from '@emotion/css';
import { Divider } from './Divider';
import { CONFIG_SECTION_HEADERS, LeftSidebar } from './LeftSidebar';

const CONTAINER_MIN_WIDTH = '450px';

// Simple sanity check for the Zabbix API URL, mirroring the validation of the
// plugin-ui ConnectionSettings component this section replaced.
const isValidUrl = (url: string) => /^https?:\/\/\S+$/.test(url);

// Bordered, collapsible container giving each configuration section the boxed
// look of the new Grafana datasource config design. The whole header row
// toggles the section, optional sections carry a top-right badge, and the id
// is the LeftSidebar scroll anchor.
const ConfigSectionBox = ({
  id,
  title,
  isOptional,
  isInitiallyOpen = true,
  description,
  children,
}: {
  id: string;
  title: string;
  isOptional?: boolean;
  isInitiallyOpen?: boolean;
  description?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const styles = useStyles2(getStyles);
  // Controlled open state: some Grafana versions only toggle CollapsableSection
  // when both isOpen and onToggle are provided.
  const [isOpen, setIsOpen] = useState(isInitiallyOpen);
  return (
    <Box borderStyle="solid" borderColor="weak" padding={2} marginBottom={4} id={id} minWidth={CONTAINER_MIN_WIDTH}>
      <CollapsableSection
        label={
          <>
            <Text element="h3" variant="h3">
              {title}
            </Text>
            {isOptional && <Badge text="optional" color="darkgrey" className={styles.optionalBadge} />}
          </>
        }
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        {description && (
          <Box marginBottom={2}>
            <Text variant="body" color="secondary">
              {description}
            </Text>
          </Box>
        )}
        {children}
      </CollapsableSection>
    </Box>
  );
};

// the postgres-plugin changed it's id, so we list both the old name and the new name
const SUPPORTED_SQL_DS = ['mysql', 'grafana-postgresql-datasource', 'postgres', 'influxdb'];

const authOptions: Array<ComboboxOption<ZabbixAuthType>> = [
  { label: 'User and password', value: ZabbixAuthType.UserLogin },
  { label: 'API token', value: ZabbixAuthType.Token },
];

const httpAuthOptions: Array<ComboboxOption<string>> = [
  {
    label: 'No Authentication',
    value: 'none',
    description: 'The Zabbix web server is reachable without extra credentials',
  },
  {
    label: 'Basic authentication',
    value: 'basic',
    description: 'Authenticate against a reverse proxy in front of Zabbix with HTTP basic auth',
  },
];

const userIdentityOptions: Array<ComboboxOption<string>> = [
  { label: 'Username', value: 'username' },
  { label: 'Email', value: 'email' },
];

export type Props = DataSourcePluginOptionsEditorProps<ZabbixDSOptions, ZabbixSecureJSONData>;
export const ConfigEditor = (props: Props) => {
  const styles = useStyles2(getStyles);
  const { options, onOptionsChange } = props;

  // Reuse the battle-tested option handlers of the plugin-ui Auth component
  // for the TLS settings and HTTP basic auth fields.
  const authProps = convertLegacyAuthProps({ config: options, onChange: onOptionsChange });

  // Derive selectedDBDatasource and currentDSType from options (prefer UID; fallback to id for legacy config)
  const { selectedDBDatasource, currentDSType } = useMemo(() => {
    if (!options.jsonData.dbConnectionEnable) {
      return { selectedDBDatasource: null, currentDSType: '' };
    }
    const dsList = getDirectDBDatasources();
    const uid = options.jsonData.dbConnectionDatasourceUID;
    const id = options.jsonData.dbConnectionDatasourceId;
    const selectedDs = uid
      ? dsList.find((d) => d.uid === uid)
      : id !== undefined && id !== null
        ? dsList.find((d) => d.id === id)
        : undefined;
    return {
      selectedDBDatasource: selectedDs ? { label: selectedDs.name, value: selectedDs.uid } : null,
      currentDSType: selectedDs?.type || '',
    };
  }, [
    options.jsonData.dbConnectionEnable,
    options.jsonData.dbConnectionDatasourceUID,
    options.jsonData.dbConnectionDatasourceId,
  ]);

  const [grafanaUsers, setGrafanaUsers] = useState<Array<SelectableValue<string>>>([
    { label: 'admin', value: 'admin' },
  ]);
  const [canEditExcludedUsers, setCanEditExcludedUsers] = useState(true);
  const [userFetchWarning, setUserFetchWarning] = useState<string | null>(null);

  // Pre-expand the optional sections on load when any setting inside them is configured
  const [tlsSettingsOpen] = useState<boolean>(() => {
    const { jsonData } = options;
    return Boolean(jsonData.tlsAuth || jsonData.tlsAuthWithCACert || jsonData.tlsSkipVerify || jsonData.serverName);
  });

  const [httpSettingsOpen] = useState<boolean>(() => {
    const { jsonData } = options;
    return Boolean(options.basicAuth || jsonData.httpHeaderName1 || jsonData.keepCookies?.length);
  });

  const [additionalSettingsOpen] = useState<boolean>(() => {
    const { jsonData } = options;
    return Boolean(
      jsonData.cacheTTL ||
      jsonData.timeout ||
      jsonData.queryTimeout ||
      jsonData.trendsFrom ||
      jsonData.trendsRange ||
      jsonData.dbConnectionEnable ||
      jsonData.disableReadOnlyUsersAck ||
      jsonData.disableDataAlignment ||
      jsonData.perUserAuth ||
      jsonData.enableSecureSocksProxy
    );
  });

  // Fetch Grafana users on mount
  useEffect(() => {
    const fetchGrafanaUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (res.status === 403) {
          setUserFetchWarning(
            'You need Grafana Admin permissions to list users. Please contact your Grafana administrator to configure per-user authentication.'
          );
          setCanEditExcludedUsers(false);
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to fetch Grafana users');
        }
        const users = await res.json();
        setGrafanaUsers(
          users.map((u: any) => ({
            label: u.login,
            value: u.login,
          }))
        );
        setUserFetchWarning(null);
        setCanEditExcludedUsers(true);
      } catch {
        setUserFetchWarning('Failed to fetch Grafana users. Using default user "admin".');
        setCanEditExcludedUsers(false);
      }
    };
    fetchGrafanaUsers();
  }, []);

  // Apply some defaults on initial render
  useEffect(() => {
    const { jsonData, secureJsonFields } = options;

    // Set secureJsonFields.password to password and then remove it from config
    const { password, ...restJsonData } = jsonData;

    // Create new secureJsonData object
    const newSecureJsonData = { ...options.secureJsonData };
    if (!secureJsonFields?.password) {
      newSecureJsonData.password = password;
    }

    onOptionsChange({
      ...options,
      jsonData: {
        authType: ZabbixAuthType.UserLogin,
        trends: true,
        trendsFrom: '',
        trendsRange: '',
        cacheTTL: '',
        timeout: undefined,
        queryTimeout: undefined,
        disableDataAlignment: false,
        ...restJsonData,
      },
      secureJsonData: { ...newSecureJsonData },
    });

    // Handle async lookup when neither uid nor id is set but name is available (legacy)
    if (
      options.jsonData.dbConnectionEnable &&
      !options.jsonData.dbConnectionDatasourceUID &&
      options.jsonData.dbConnectionDatasourceId == null
    ) {
      const dsName = options.jsonData.dbConnectionDatasourceName;
      if (dsName) {
        getDataSourceSrv()
          .get(dsName)
          .then((ds) => {
            if (ds?.uid) {
              onOptionsChange({
                ...options,
                jsonData: {
                  ...options.jsonData,
                  dbConnectionDatasourceUID: ds.uid,
                  dbConnectionDatasourceName: ds.name,
                },
              });
            }
          });
      }
    }
  }, []);

  return (
    <Stack justifyContent="space-between">
      <div className={styles.leftSidebarWrapper}>
        <LeftSidebar />
      </div>

      <Box width="60%" flex="1 1 auto" minWidth={CONTAINER_MIN_WIDTH}>
        <Box marginBottom={2}>
          <Text variant="bodySmall" color="secondary">
            Fields marked with * are required
          </Text>
        </Box>

        <ConfigSectionBox
          id={CONFIG_SECTION_HEADERS[0].id}
          title="Zabbix connection"
          description={
            <>
              Enter the full URL of the Zabbix web frontend and the credentials used to authenticate against the Zabbix
              API. If you need further guidance, visit the{' '}
              <TextLink href="https://grafana.com/grafana/plugins/alexanderzobnin-zabbix-app/" external>
                Grafana docs
              </TextLink>
            </>
          }
        >
          <Field
            label="URL"
            required
            invalid={!!options.url && !isValidUrl(options.url)}
            error="Please enter a valid URL"
            description="Full URL of the Zabbix API endpoint"
          >
            <Input
              id="zabbix-url"
              name="url"
              placeholder="http://localhost/zabbix/api_jsonrpc.php"
              aria-label="Data source connection URL"
              value={options.url || ''}
              onChange={(event) => onOptionsChange({ ...options, url: event.currentTarget.value })}
            />
          </Field>

          <Field label="Auth type" description="How the plugin signs in to the Zabbix API">
            <Combobox
              id="zabbix-auth-type"
              width={40}
              options={authOptions}
              value={options.jsonData.authType}
              onChange={jsonDataSelectHandler('authType', options, onOptionsChange)}
            />
          </Field>

          {options.jsonData?.authType === ZabbixAuthType.UserLogin && (
            <div className={styles.fieldRow}>
              <Field
                label="Username"
                description="Zabbix user with sufficient permissions to read the monitored data"
                required
              >
                <Input
                  id="zabbix-username"
                  name="username"
                  placeholder="Enter username"
                  aria-label="Username"
                  value={options.jsonData.username || ''}
                  onChange={jsonDataChangeHandler('username', options, onOptionsChange)}
                />
              </Field>
              <Field label="Password" description="Password of the Zabbix user" required>
                <SecretInput
                  id="zabbix-password"
                  name="password"
                  placeholder="Enter password"
                  aria-label="Password"
                  isConfigured={options.secureJsonFields && options.secureJsonFields.password}
                  onReset={resetSecureJsonField('password', options, onOptionsChange)}
                  onBlur={secureJsonDataChangeHandler('password', options, onOptionsChange)}
                />
              </Field>
            </div>
          )}

          {options.jsonData?.authType === ZabbixAuthType.Token && (
            <Field
              label="API Token"
              description="Token generated in Zabbix under User settings → API tokens (Zabbix 5.4 or later)"
              required
            >
              <SecretInput
                id="zabbix-api-token"
                name="apiToken"
                placeholder="Enter API token"
                aria-label="API token"
                isConfigured={options.secureJsonFields && options.secureJsonFields.apiToken}
                onReset={resetSecureJsonField('apiToken', options, onOptionsChange)}
                onBlur={secureJsonDataChangeHandler('apiToken', options, onOptionsChange)}
              />
            </Field>
          )}
        </ConfigSectionBox>

        <ConfigSectionBox
          id={CONFIG_SECTION_HEADERS[1].id}
          title="TLS/SSL settings"
          isOptional
          isInitiallyOpen={tlsSettingsOpen}
        >
          <div className={styles.tlsSettingsWrapper}>
            {authProps.TLS && <TLSSettings {...authProps.TLS} readOnly={!!options.readOnly} />}
          </div>
        </ConfigSectionBox>

        <ConfigSectionBox
          id={CONFIG_SECTION_HEADERS[2].id}
          title="HTTP settings"
          isOptional
          isInitiallyOpen={httpSettingsOpen}
          description="Settings for the HTTP connection between Grafana and the Zabbix web server. Use Basic authentication only when the Zabbix web frontend sits behind a reverse proxy that requires its own credentials. This is separate from the Zabbix API credentials configured above"
        >
          <Field label="Authentication method">
            <Combobox
              id="zabbix-http-auth-method"
              width={40}
              options={httpAuthOptions}
              value={options.basicAuth ? 'basic' : 'none'}
              onChange={(option) => onOptionsChange({ ...options, basicAuth: option.value === 'basic' })}
            />
          </Field>

          {options.basicAuth && (
            <div className={styles.fieldRow}>
              <Field label="User" description="Username expected by the reverse proxy">
                <Input
                  id="zabbix-basic-auth-user"
                  name="basicAuthUser"
                  placeholder="Enter username"
                  aria-label="Basic auth user"
                  value={options.basicAuthUser || ''}
                  onChange={(event) => authProps.basicAuth?.onUserChange(event.currentTarget.value)}
                />
              </Field>
              <Field label="Password" description="Password expected by the reverse proxy">
                <SecretInput
                  id="zabbix-basic-auth-password"
                  name="basicAuthPassword"
                  placeholder="Enter basic auth password"
                  aria-label="Basic auth password"
                  isConfigured={!!options.secureJsonFields?.basicAuthPassword}
                  onReset={() => authProps.basicAuth?.onPasswordReset()}
                  onBlur={(event) => authProps.basicAuth?.onPasswordChange(event.currentTarget.value)}
                />
              </Field>
            </div>
          )}

          <CustomHeadersSettings dataSourceConfig={options} onChange={onOptionsChange} />

          <ConfigSubSection title="Advanced HTTP settings">
            <Field
              label="Allowed cookies"
              description="Grafana proxy deletes forwarded cookies by default. Specify cookies by name that should be forwarded to the data source"
            >
              <TagsInput
                id="zabbix-allowed-cookies"
                placeholder="Enter cookie name (hit enter to add)"
                tags={options.jsonData.keepCookies}
                onChange={(cookies) =>
                  onOptionsChange({ ...options, jsonData: { ...options.jsonData, keepCookies: cookies } })
                }
              />
            </Field>
          </ConfigSubSection>
        </ConfigSectionBox>

        <ConfigSectionBox
          id={CONFIG_SECTION_HEADERS[3].id}
          title="Additional settings"
          isOptional
          isInitiallyOpen={additionalSettingsOpen}
          description="Additional settings are optional settings that can be configured for more control over your data source. This includes trends, cache, direct DB connection and per-user authentication"
        >
          <ConfigSubSection title="Zabbix API" description="Fine-tune how the plugin communicates with the Zabbix API">
            <div className={styles.fieldRow}>
              <Field
                label="Cache TTL"
                description="Zabbix data source caches metric names in memory. Specify how often data will be updated"
              >
                <Input
                  id="zabbix-cache-ttl"
                  name="cacheTTL"
                  value={options.jsonData.cacheTTL || ''}
                  placeholder="1h"
                  aria-label="Cache TTL"
                  onChange={jsonDataChangeHandler('cacheTTL', options, onOptionsChange)}
                />
              </Field>

              <Field label="Timeout" description="Zabbix API connection timeout in seconds. Default is 30">
                <Input
                  id="zabbix-timeout"
                  name="timeout"
                  type="number"
                  value={options.jsonData.timeout}
                  placeholder="30"
                  aria-label="Timeout"
                  onChange={(event) => {
                    onOptionsChange({
                      ...options,
                      jsonData: { ...options.jsonData, timeout: parseInt(event.currentTarget.value, 10) },
                    });
                  }}
                />
              </Field>
            </div>
          </ConfigSubSection>

          <Divider />

          <ConfigSubSection title="Query options" description="Limits applied to queries issued by the plugin">
            <Field
              label="Query Timeout"
              description="Maximum execution time in seconds for database queries initiated by the plugin. Queries exceeding this limit will be automatically terminated. Default is 60 seconds"
            >
              <Input
                id="zabbix-query-timeout"
                name="queryTimeout"
                type="number"
                value={options.jsonData.queryTimeout}
                placeholder="60"
                aria-label="Query Timeout"
                onChange={(event) => {
                  onOptionsChange({
                    ...options,
                    jsonData: {
                      ...options.jsonData,
                      queryTimeout: parseInt(event.currentTarget.value, 10) || undefined,
                    },
                  });
                }}
              />
            </Field>
          </ConfigSubSection>

          <Divider />

          <ConfigSubSection
            title="Trends"
            description="Use trend data for long time ranges to improve performance and query data beyond the history storage period"
          >
            <Field label="Enable Trends">
              <Switch
                id="zabbix-enable-trends"
                value={options.jsonData.trends}
                onChange={jsonDataSwitchHandler('trends', options, onOptionsChange)}
              />
            </Field>

            {options.jsonData.trends && (
              <div className={styles.fieldRow}>
                <Field
                  label="After"
                  description="Time after which trends will be used. Best practice is to set this value to your history storage period (7d, 30d, etc)"
                >
                  <Input
                    id="zabbix-trends-after"
                    name="trendsFrom"
                    placeholder="7d"
                    aria-label="After"
                    value={options.jsonData.trendsFrom || ''}
                    onChange={jsonDataChangeHandler('trendsFrom', options, onOptionsChange)}
                  />
                </Field>
                <Field
                  label="Range"
                  description="Time range width after which trends will be used instead of history. It's better to set this value in range of 4 to 7 days to prevent loading large amount of history data"
                >
                  <Input
                    id="zabbix-trends-range"
                    name="trendsRange"
                    placeholder="4d"
                    aria-label="Range"
                    value={options.jsonData.trendsRange || ''}
                    onChange={jsonDataChangeHandler('trendsRange', options, onOptionsChange)}
                  />
                </Field>
              </div>
            )}
          </ConfigSubSection>

          <Divider />

          <ConfigSubSection
            title="Direct DB Connection"
            description="Query history and trends directly from the Zabbix database instead of the API. This is usually significantly faster for large amounts of data"
          >
            <Field label="Enable Direct DB Connection">
              <Switch
                id="zabbix-enable-db-connection"
                value={options.jsonData.dbConnectionEnable}
                onChange={jsonDataSwitchHandler('dbConnectionEnable', options, onOptionsChange)}
              />
            </Field>

            {options.jsonData.dbConnectionEnable && (
              <>
                <Field
                  label="Data Source"
                  description="Data source pointing at the Zabbix history database (MySQL, PostgreSQL or InfluxDB)"
                >
                  <Combobox
                    id="zabbix-db-datasource"
                    value={selectedDBDatasource}
                    options={getDirectDBDSOptions()}
                    onChange={directDBDatasourceChangeHandler(options, onOptionsChange)}
                    placeholder="Select a DB datasource (MySQL, PostgreSQL, InfluxDB)"
                  />
                </Field>

                {currentDSType === 'influxdb' && (
                  <Field
                    label="Retention Policy"
                    description="Specify retention policy name for fetching long-term stored data (optional). Leave it blank if only default retention policy used"
                  >
                    <Input
                      id="zabbix-retention-policy"
                      name="dbConnectionRetentionPolicy"
                      value={options.jsonData.dbConnectionRetentionPolicy || ''}
                      placeholder="Retention policy name"
                      aria-label="Retention Policy"
                      onChange={jsonDataChangeHandler('dbConnectionRetentionPolicy', options, onOptionsChange)}
                    />
                  </Field>
                )}
              </>
            )}
          </ConfigSubSection>

          <Divider />

          <ConfigSubSection
            title="Per-user authentication"
            description="Map Grafana users to Zabbix users respecting the RBAC already set up in Zabbix"
          >
            <Field label="Enable per-user authentication">
              <Switch
                id="zabbix-per-user-auth"
                value={!!options.jsonData.perUserAuth}
                onChange={jsonDataSwitchHandler('perUserAuth', options, onOptionsChange)}
              />
            </Field>

            {options.jsonData.perUserAuth && (
              <>
                {userFetchWarning && (
                  <Alert title="Cannot list Grafana users" severity="warning">
                    {userFetchWarning}
                  </Alert>
                )}

                <div className={styles.fieldRow}>
                  <Field
                    label="User identity field"
                    description="Grafana user attribute matched against the Zabbix username"
                  >
                    <Combobox
                      id="zabbix-per-user-auth-field"
                      options={userIdentityOptions}
                      value={{
                        label: options.jsonData.perUserAuthField === 'email' ? 'Email' : 'Username',
                        value: options.jsonData.perUserAuthField || 'username',
                      }}
                      onChange={jsonDataSelectHandler('perUserAuthField', options, onOptionsChange)}
                    />
                  </Field>

                  <Field
                    label="Exclude users from per-user authentication"
                    description="These users will always use the global Zabbix credentials"
                  >
                    <MultiSelect
                      inputId="zabbix-per-user-auth-exclude"
                      options={grafanaUsers}
                      allowCustomValue
                      value={(options.jsonData.perUserAuthExcludeUsers ?? ['admin']).map(
                        (u) => ({ label: u, value: u }) as SelectableValue<string>
                      )}
                      onChange={
                        canEditExcludedUsers
                          ? (selected) => {
                              onOptionsChange({
                                ...options,
                                jsonData: {
                                  ...options.jsonData,
                                  perUserAuthExcludeUsers: selected.map((s) => s.value),
                                },
                              });
                            }
                          : undefined
                      }
                      disabled={!canEditExcludedUsers}
                    />
                  </Field>
                </div>
              </>
            )}
          </ConfigSubSection>

          <Divider />

          <ConfigSubSection title="Other">
            <Field label="Disable acknowledges for read-only users">
              <Switch
                id="zabbix-disable-ro-ack"
                value={options.jsonData.disableReadOnlyUsersAck}
                onChange={jsonDataSwitchHandler('disableReadOnlyUsersAck', options, onOptionsChange)}
              />
            </Field>

            <Field
              label="Disable data alignment"
              description="Data alignment feature aligns points based on item update interval. For instance, if value collected once per minute, then timestamp of the each point will be set to the start of corresponding minute. This alignment required for proper work of the stacked graphs. If you don't need stacked graphs and want to get exactly the same timestamps as in Zabbix, then you can disable this feature"
            >
              <Switch
                id="zabbix-disable-data-alignment"
                value={!!options.jsonData.disableDataAlignment}
                onChange={jsonDataSwitchHandler('disableDataAlignment', options, onOptionsChange)}
              />
            </Field>
          </ConfigSubSection>

          {config.secureSocksDSProxyEnabled && gte(config.buildInfo.version, '10.0.0-0') && (
            <>
              <Divider />
              <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
            </>
          )}
        </ConfigSectionBox>
      </Box>

      <Box width="20%" flex="0 0 20%">
        {/* Reserved for a right sidebar, mirroring the new Grafana config design */}
      </Box>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  // Lays out sibling fields side by side, each filling an equal share of the
  // section box and wrapping on narrow screens (ClickHouse config-v2 pattern).
  // Each field is a column with a growing label block so the inputs stay
  // bottom-aligned even when one description wraps to more lines.
  fieldRow: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),

    '& > div': {
      flex: '1 1 300px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',

      '& > div:first-child': {
        flexGrow: 1,
      },
    },
  }),
  optionalBadge: css({
    marginLeft: 'auto',
  }),
  // TLSSettings hard-codes a top margin on its container, which stacks with
  // the CollapsableSection content padding into a large empty gap.
  tlsSettingsWrapper: css({
    '& > div': {
      marginTop: 0,
    },
  }),
  leftSidebarWrapper: css({
    width: '250px',
    flex: '0 0 250px',
    position: 'sticky',
    top: '100px',
    alignSelf: 'flex-start',
    maxHeight: 'calc(100vh - 100px)',
    overflow: 'hidden',
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  }),
});

const jsonDataChangeHandler =
  (
    key: keyof ZabbixDSOptions,
    value: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
    onChange: Props['onOptionsChange']
  ) =>
  (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({
      ...value,
      jsonData: {
        ...value.jsonData,
        [key]: event.currentTarget.value,
      },
    });
  };

const jsonDataSelectHandler =
  (
    key: keyof ZabbixDSOptions,
    value: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
    onChange: Props['onOptionsChange']
  ) =>
  (option: ComboboxOption) => {
    onChange({
      ...value,
      jsonData: {
        ...value.jsonData,
        [key]: option.value,
      },
    });
  };

const jsonDataSwitchHandler =
  (
    key: keyof ZabbixDSOptions,
    value: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
    onChange: Props['onOptionsChange']
  ) =>
  (event: React.SyntheticEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      jsonData: {
        ...value.jsonData,
        [key]: (event.target as HTMLInputElement).checked,
      },
    });
  };

const secureJsonDataChangeHandler =
  (
    key: keyof ZabbixSecureJSONData,
    value: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
    onChange: Props['onOptionsChange']
  ) =>
  (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({
      ...value,
      secureJsonData: {
        ...value.secureJsonData,
        [key]: event.currentTarget.value,
      },
    });
  };

const resetSecureJsonField =
  (
    key: keyof ZabbixSecureJSONData,
    value: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
    onChange: Props['onOptionsChange']
  ) =>
  () => {
    onChange({
      ...value,
      secureJsonFields: {
        ...value.secureJsonFields,
        [key]: false,
      },
    });
  };

const directDBDatasourceChangeHandler =
  (options: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>, onChange: Props['onOptionsChange']) =>
  (value: ComboboxOption<string>) => {
    const dsList = getDirectDBDatasources();
    const ds = value.value ? dsList.find((d) => d.uid === value.value) : undefined;
    onChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        dbConnectionDatasourceUID: value.value ?? undefined,
        dbConnectionDatasourceName: ds?.name ?? options.jsonData.dbConnectionDatasourceName,
        dbConnectionDatasourceId: undefined, // prefer uid only
      },
    });
  };

const getDirectDBDatasources = () => {
  const dsFilters: GetDataSourceListFilters = {
    type: SUPPORTED_SQL_DS,
  };
  const dsList = getDataSourceSrv().getList(dsFilters);
  return dsList;
};

const getDirectDBDSOptions = () => {
  const dsList: Array<DataSourceInstanceSettings<DataSourceJsonData>> = getDirectDBDatasources();
  const dsOpts: Array<ComboboxOption<string>> = dsList.map((ds) => ({
    label: ds.name,
    value: ds.uid,
    description: ds.type,
  }));
  return dsOpts;
};
