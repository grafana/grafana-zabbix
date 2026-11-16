import { test, expect } from '@grafana/plugin-e2e';

const PLUGIN_TYPE = 'alexanderzobnin-zabbix-datasource';
const PROVISIONED_FILE = 'datasources.yml';
const DS_NAME = 'Zabbix E2E';
// The Grafana backend runs the health check from inside the Compose network,
// so it reaches Zabbix at the service name, not localhost.
const REACHABLE_URL = 'http://zabbix-web:8080/api_jsonrpc.php';

test.describe('Config editor', () => {
  test.describe('rendering', () => {
    test(
      'smoke: renders the config editor',
      { tag: '@plugins' },
      async ({ createDataSourceConfigPage, page }) => {
        await createDataSourceConfigPage({ type: PLUGIN_TYPE });
        await expect(page.getByRole('heading', { name: 'Zabbix Connection' })).toBeVisible();
      }
    );

    test('renders the connection, auth and Zabbix sections', async ({ createDataSourceConfigPage, page }) => {
      await createDataSourceConfigPage({ type: PLUGIN_TYPE });
      await expect(page.getByText('Connection', { exact: true })).toBeVisible();
      await expect(page.getByText('Authentication', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Zabbix Connection' })).toBeVisible();
      await expect(page.getByText('Additional settings')).toBeVisible();
      await expect(page.getByText('Auth type')).toBeVisible();
    });
  });

  test.describe('provisioned datasource', () => {
    test('loads the provisioned connection settings', async ({
      readProvisionedDataSource,
      gotoDataSourceConfigPage,
      page,
    }) => {
      const ds = await readProvisionedDataSource({ fileName: PROVISIONED_FILE, name: DS_NAME });
      await gotoDataSourceConfigPage(ds.uid);
      await expect(page.getByRole('textbox', { name: 'Data source connection URL' })).toHaveValue(ds.url);
      await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('Admin');
    });
  });

  // Provisioned datasources can't have their URL/credentials edited, so the
  // health-check tests create a fresh, ephemeral datasource (auto-torn-down by
  // createDataSourceConfigPage), configure it, then run Save & test.
  test.describe('save & test', () => {
    test('passes the health check against a reachable Zabbix', async ({ createDataSourceConfigPage, page }) => {
      const configPage = await createDataSourceConfigPage({ type: PLUGIN_TYPE });
      await page.getByRole('textbox', { name: 'Data source connection URL' }).fill(REACHABLE_URL);
      await page.getByRole('textbox', { name: 'Username' }).fill('Admin');
      await page.getByPlaceholder('Password').fill('zabbix');
      await configPage.saveAndTest();
      await expect(page.getByText(/Zabbix API version/i)).toBeVisible({ timeout: 15000 });
    });

    test('shows an error when Zabbix is unreachable', async ({ createDataSourceConfigPage, page }) => {
      const configPage = await createDataSourceConfigPage({ type: PLUGIN_TYPE });
      await page.getByRole('textbox', { name: 'Data source connection URL' }).fill('http://localhost:1/api_jsonrpc.php');
      await page.getByRole('textbox', { name: 'Username' }).fill('Admin');
      await page.getByPlaceholder('Password').fill('zabbix');
      await configPage.saveAndTest();
      await expect(page.getByText(/Zabbix API version/i)).toBeHidden();
    });
  });

  // The DB data source picker and the legacy DB connection configs are resolved
  // through the async data source lookups. Legacy configs can only be created
  // through the API, so these tests create the Zabbix data source there and
  // delete it afterwards.
  test.describe('direct DB connection', () => {
    const DB_DS_NAME = 'E2E Zabbix DB';
    const DB_PICKER_PLACEHOLDER = 'Select a DB datasource (MySQL, PostgreSQL, InfluxDB)';

    const zabbixDataSource = (jsonData: Record<string, unknown>) => ({
      type: PLUGIN_TYPE,
      url: REACHABLE_URL,
      jsonData: { username: 'Admin', dbConnectionEnable: true, ...jsonData },
      secureJsonData: { password: 'zabbix' },
    });

    test('lists the SQL data sources and connects to the selected one', async ({
      readProvisionedDataSource,
      createDataSource,
      gotoDataSourceConfigPage,
      grafanaAPIClient,
      page,
    }) => {
      const dbDs = await readProvisionedDataSource({ fileName: PROVISIONED_FILE, name: DB_DS_NAME });
      const ds = await createDataSource(
        zabbixDataSource({ dbConnectionDatasourceUID: dbDs.uid, dbConnectionDatasourceName: dbDs.name })
      );
      try {
        const configPage = await gotoDataSourceConfigPage(ds.uid);
        const picker = page.getByPlaceholder(DB_PICKER_PLACEHOLDER);
        await expect(picker).toHaveValue(dbDs.name);

        await picker.click();
        await expect(page.getByRole('option').filter({ hasText: dbDs.name })).toBeVisible();
        await page.keyboard.press('Escape');

        await configPage.saveAndTest();
        await expect(page.getByText(`DB connector type: ${dbDs.type}, DB connector name: ${dbDs.name}`)).toBeVisible({
          timeout: 15000,
        });
      } finally {
        await grafanaAPIClient.deleteDataSourceByUID(ds.uid);
      }
    });

    test('shows the DB data source of a legacy config that references it by name', async ({
      readProvisionedDataSource,
      createDataSource,
      gotoDataSourceConfigPage,
      grafanaAPIClient,
      page,
    }) => {
      const dbDs = await readProvisionedDataSource({ fileName: PROVISIONED_FILE, name: DB_DS_NAME });
      const ds = await createDataSource(zabbixDataSource({ dbConnectionDatasourceName: dbDs.name }));
      try {
        await gotoDataSourceConfigPage(ds.uid);
        await expect(page.getByPlaceholder(DB_PICKER_PLACEHOLDER)).toHaveValue(dbDs.name);
      } finally {
        await grafanaAPIClient.deleteDataSourceByUID(ds.uid);
      }
    });

    test('connects to the DB data source of a legacy config that references it by numeric id', async ({
      readProvisionedDataSource,
      createDataSource,
      gotoDataSourceConfigPage,
      grafanaAPIClient,
      page,
    }) => {
      const dbDs = await readProvisionedDataSource({ fileName: PROVISIONED_FILE, name: DB_DS_NAME });
      // The numeric id is assigned by Grafana, so it can't come from the provisioning file
      const { id: dbDsId } = await (await grafanaAPIClient.getDataSourceByName(dbDs.name)).json();
      const ds = await createDataSource(zabbixDataSource({ dbConnectionDatasourceId: dbDsId }));
      try {
        const configPage = await gotoDataSourceConfigPage(ds.uid);
        await expect(page.getByPlaceholder(DB_PICKER_PLACEHOLDER)).toHaveValue(dbDs.name);

        // The editor doesn't rewrite the legacy config, so the saved data source still
        // has only the id and the DB connector has to resolve it.
        await configPage.saveAndTest();
        await expect(page.getByText(`DB connector type: ${dbDs.type}, DB connector name: ${dbDs.name}`)).toBeVisible({
          timeout: 15000,
        });
      } finally {
        await grafanaAPIClient.deleteDataSourceByUID(ds.uid);
      }
    });
  });
});
