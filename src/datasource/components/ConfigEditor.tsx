import React, { useEffect, useState } from 'react';
import { getDataSourceSrv, config } from '@grafana/runtime';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings, GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Combobox,
  ComboboxOption,
  Field,
  Icon,
  Input,
  Label,
  SecretInput,
  SecureSocksProxySettings,
  Switch,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { ZabbixAuthType, ZabbixDSOptions, ZabbixSecureJSONData } from '../types/config';
import { gte } from 'semver';
import {
  Auth,
  ConfigSection,
  ConfigSubSection,
  EditorStack,
  convertLegacyAuthProps,
  ConnectionSettings,
  DataSourceDescription,
  AdvancedHttpSettings,
} from '@grafana/plugin-ui';
import { Divider } from './Divider';
import { css } from '@emotion/css';

// the postgres-plugin changed it's id, so we list both the old name and the new name
const SUPPORTED_SQL_DS = ['mysql', 'grafana-postgresql-datasource', 'postgres', 'influxdb'];

const authOptions: Array<ComboboxOption<ZabbixAuthType>> = [
  { label: 'User and password', value: ZabbixAuthType.UserLogin },
  { label: 'API token', value: ZabbixAuthType.Token },
];

export type Props = DataSourcePluginOptionsEditorProps<ZabbixDSOptions, ZabbixSecureJSONData>;
export const ConfigEditor = (props: Props) => {
  const styles = useStyles2(getStyles);
  const { options, onOptionsChange } = props;

  const [selectedDBDatasource, setSelectedDBDatasource] = useState(null);
  const [currentDSType, setCurrentDSType] = useState('');

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
        disableDataAlignment: false,
        ...restJsonData,
      },
      secureJsonData: { ...newSecureJsonData },
    });

    if (options.jsonData.dbConnectionEnable) {
      if (!options.jsonData.dbConnectionDatasourceId) {
        const dsName = options.jsonData.dbConnectionDatasourceName;
        getDataSourceSrv()
          .get(dsName)
          .then((ds) => {
            if (ds) {
              const selectedDs = getDirectDBDatasources().find((dsOption) => dsOption.id === ds.id);
              setSelectedDBDatasource({ label: selectedDs?.name, value: selectedDs?.id });
              setCurrentDSType(selectedDs?.type);
              onOptionsChange({
                ...options,
                jsonData: {
                  ...options.jsonData,
                  dbConnectionDatasourceId: ds.id,
                },
              });
            }
          });
      } else {
        const selectedDs = getDirectDBDatasources().find(
          (dsOption) => dsOption.id === options.jsonData.dbConnectionDatasourceId
        );
        setSelectedDBDatasource({ label: selectedDs?.name, value: selectedDs?.id });
        setCurrentDSType(selectedDs?.type);
      }
    }
  }, []);

  return (
    <>
      <DataSourceDescription
        dataSourceName="Zabbix"
        docsLink="https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configuration/"
        hasRequiredFields={true}
      />

      <Divider />

      <ConnectionSettings
        config={options}
        onChange={onOptionsChange}
        urlPlaceholder="http://localhost/zabbix/api_jsonrpc.php"
      />

      <Divider />

      <Auth
        {...convertLegacyAuthProps({
          config: options,
          onChange: onOptionsChange,
        })}
      />

      <Divider />

      <ConfigSection title="Zabbix Connection">
        <Field label="Auth type">
          <Combobox
            width={40}
            options={authOptions}
            value={options.jsonData.authType}
            onChange={jsonDataSelectHandler('authType', options, onOptionsChange)}
          />
        </Field>

        {options.jsonData?.authType === ZabbixAuthType.UserLogin && (
          <>
            <Field label="Username">
              <Input
                width={40}
                placeholder="Username"
                value={options.jsonData.username || ''}
                onChange={jsonDataChangeHandler('username', options, onOptionsChange)}
              />
            </Field>
            <Field label="Password">
              <SecretInput
                width={40}
                placeholder="Password"
                isConfigured={options.secureJsonFields && options.secureJsonFields.password}
                onReset={resetSecureJsonField('password', options, onOptionsChange)}
                onBlur={secureJsonDataChangeHandler('password', options, onOptionsChange)}
              />
            </Field>
          </>
        )}

        {options.jsonData?.authType === ZabbixAuthType.Token && (
          <>
            <Field label="API Token">
              <SecretInput
                width={40}
                placeholder="API token"
                isConfigured={options.secureJsonFields && options.secureJsonFields.apiToken}
                onReset={resetSecureJsonField('apiToken', options, onOptionsChange)}
                onBlur={secureJsonDataChangeHandler('apiToken', options, onOptionsChange)}
              />
            </Field>
          </>
        )}
      </ConfigSection>

      <Divider />

      <ConfigSection title="Additional settings" isCollapsible>
        <AdvancedHttpSettings config={options} onChange={onOptionsChange} />

        <div className={styles.space} />

        <ConfigSubSection title="Zabbix API">
          <Field
            label={
              <Label>
                <EditorStack gap={0.5}>
                  <span>Cache TTL</span>
                  <Tooltip
                    content={
                      <span>
                        Zabbix data source caches metric names in memory. Specify how often data will be updated.
                      </span>
                    }
                  >
                    <Icon name="info-circle" size="sm" />
                  </Tooltip>
                </EditorStack>
              </Label>
            }
          >
            <Input
              width={40}
              value={options.jsonData.cacheTTL || ''}
              placeholder="1h"
              onChange={jsonDataChangeHandler('cacheTTL', options, onOptionsChange)}
            />
          </Field>

          <Field
            label={
              <Label>
                <EditorStack gap={0.5}>
                  <span>Timeout</span>
                  <Tooltip content={<span>Zabbix API connection timeout in seconds. Default is 30.</span>}>
                    <Icon name="info-circle" size="sm" />
                  </Tooltip>
                </EditorStack>
              </Label>
            }
          >
            <Input
              width={40}
              type="number"
              value={options.jsonData.timeout}
              placeholder="30"
              onChange={(event) => {
                onOptionsChange({
                  ...options,
                  jsonData: { ...options.jsonData, timeout: parseInt(event.currentTarget.value, 10) },
                });
              }}
            />
          </Field>
        </ConfigSubSection>

        <ConfigSubSection title="Trends">
          <Field label="Enable Trends">
            <Switch
              value={options.jsonData.trends}
              onChange={jsonDataSwitchHandler('trends', options, onOptionsChange)}
            />
          </Field>

          {options.jsonData.trends && (
            <>
              <Field
                label={
                  <Label>
                    <EditorStack gap={0.5}>
                      <span>After</span>
                      <Tooltip
                        content={
                          <span>
                            Time after which trends will be used. Best practice is to set this value to your history
                            storage period (7d, 30d, etc).
                          </span>
                        }
                      >
                        <Icon name="info-circle" size="sm" />
                      </Tooltip>
                    </EditorStack>
                  </Label>
                }
              >
                <Input
                  width={40}
                  placeholder="7d"
                  value={options.jsonData.trendsFrom || ''}
                  onChange={jsonDataChangeHandler('trendsFrom', options, onOptionsChange)}
                />
              </Field>
              <Field
                label={
                  <Label>
                    <EditorStack gap={0.5}>
                      <span>Range</span>
                      <Tooltip
                        content={
                          <span>
                            Time range width after which trends will be used instead of history. It&aposs better to set
                            this value in range of 4 to 7 days to prevent loading large amount of history data.
                          </span>
                        }
                      >
                        <Icon name="info-circle" size="sm" />
                      </Tooltip>
                    </EditorStack>
                  </Label>
                }
              >
                <Input
                  width={40}
                  placeholder="4d"
                  value={options.jsonData.trendsRange || ''}
                  onChange={jsonDataChangeHandler('trendsRange', options, onOptionsChange)}
                />
              </Field>
            </>
          )}
        </ConfigSubSection>

        <ConfigSubSection title="Direct DB Connection">
          <Field label="Enable Direct DB Connection">
            <Switch
              value={options.jsonData.dbConnectionEnable}
              onChange={jsonDataSwitchHandler('dbConnectionEnable', options, onOptionsChange)}
            />
          </Field>

          {options.jsonData.dbConnectionEnable && (
            <>
              <Field label="Data Source">
                <Combobox
                  width={40}
                  value={selectedDBDatasource}
                  options={getDirectDBDSOptions()}
                  onChange={directDBDatasourceChanegeHandler(
                    options,
                    onOptionsChange,
                    setSelectedDBDatasource,
                    setCurrentDSType
                  )}
                />
              </Field>

              {currentDSType === 'influxdb' && (
                <Field label="Retention Policy">
                  <Input
                    width={40}
                    value={options.jsonData.dbConnectionRetentionPolicy || ''}
                    placeholder="Retention policy name"
                    onChange={jsonDataChangeHandler('dbConnectionRetentionPolicy', options, onOptionsChange)}
                    // tooltip="Specify retention policy name for fetching long-term stored data (optional).
                    // Leave it blank if only default retention policy used."
                  />
                </Field>
              )}
            </>
          )}
        </ConfigSubSection>

        <ConfigSubSection title="Other">
          <Field label="Disable acknowledges for read-only users">
            <Switch
              label="Disable acknowledges for read-only users"
              value={options.jsonData.disableReadOnlyUsersAck}
              onChange={jsonDataSwitchHandler('disableReadOnlyUsersAck', options, onOptionsChange)}
            />
          </Field>

          <Field
            label={
              <Label>
                <EditorStack gap={0.5}>
                  <span>Disable data alignment</span>
                  <Tooltip
                    content={
                      <span>
                        Data alignment feature aligns points based on item update interval. For instance, if value
                        collected once per minute, then timestamp of the each point will be set to the start of
                        corresponding minute. This alignment required for proper work of the stacked graphs. If you
                        don&apos;t need stacked graphs and want to get exactly the same timestamps as in Zabbix, then
                        you can disable this feature.
                      </span>
                    }
                  >
                    <Icon name="info-circle" size="sm" />
                  </Tooltip>
                </EditorStack>
              </Label>
            }
          >
            <Switch
              value={!!options.jsonData.disableDataAlignment}
              onChange={jsonDataSwitchHandler('disableDataAlignment', options, onOptionsChange)}
            />
          </Field>
        </ConfigSubSection>

        {config.secureSocksDSProxyEnabled && gte(config.buildInfo.version, '10.0.0-0') && (
          <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
        )}
      </ConfigSection>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    space: css({
      width: '100%',
      height: theme.spacing(2),
    }),
  };
};

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

const directDBDatasourceChanegeHandler =
  (
    options: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
    onChange: Props['onOptionsChange'],
    setSelectedDS: React.Dispatch<any>,
    setSelectedDSType: React.Dispatch<any>
  ) =>
  (value: SelectableValue<number>) => {
    const selectedDs = getDirectDBDatasources().find((dsOption) => dsOption.id === value.value);
    setSelectedDS({ label: selectedDs.name, value: selectedDs.id });
    setSelectedDSType(selectedDs.type);
    onChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        dbConnectionDatasourceId: value.value,
      },
    });
  };

const getDirectDBDatasources = () => {
  let dsList = (getDataSourceSrv() as any).getAll();
  dsList = dsList.filter((ds) => SUPPORTED_SQL_DS.includes(ds.type));
  return dsList;
};

const getDirectDBDSOptions = () => {
  const dsList = getDirectDBDatasources();
  const dsOpts: Array<ComboboxOption<number>> = dsList.map((ds) => ({
    label: ds.name,
    value: ds.id,
    description: ds.type,
  }));
  return dsOpts;
};
