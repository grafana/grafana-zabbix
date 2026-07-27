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
});
