import { test, expect } from '@grafana/plugin-e2e';

/**
 * End-to-end tests for the Problems panel's data source lookups, which go
 * through the async data source APIs (grafana/grafana-zabbix#2567).
 *
 * The dashboard queries the provisioned "E2E Zabbix severity overrides" data
 * source, which renames severity High (priority 4) globally:
 *   - the table panel targets it through a `${ds}` data source variable, so the
 *     query resolves the variable before it runs;
 *   - both panels look up the data source to show its name;
 *   - the global severity override is read from the data source settings;
 *   - expanding a problem loads its alerts through the data source instance.
 *
 * Requires the e2e environment (docker-compose.yml) with seeded fixtures.
 */

const PROVISIONED_FILE = 'datasources.yml';
const DS_NAME = 'E2E Zabbix severity overrides';
const DASHBOARD_FILE = 'problems-datasource-lookups.json';
const PROBLEM = 'E2E problem 0 on e2e-fixture-host';

type SeverityOverridesJsonData = { severityOverrides: Array<{ priority: number; name: string }> };

const isZabbixApi = (url: string) => url.includes('/resources/zabbix-api');
const isMethod = (postData: string | null, method: string) => !!postData && postData.includes(`"${method}"`);

test('table queried through a data source variable shows the data source name and global severity', async ({
  readProvisionedDataSource,
  readProvisionedDashboard,
  gotoDashboardPage,
  page,
}) => {
  const ds = await readProvisionedDataSource<SeverityOverridesJsonData>({ fileName: PROVISIONED_FILE, name: DS_NAME });
  const dashboard = await readProvisionedDashboard({ fileName: DASHBOARD_FILE });

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();

  const panel = page.getByRole('region', { name: 'Problems table via data source variable' });
  const row = panel.getByRole('row').filter({ hasText: PROBLEM });
  await expect(row).toContainText(ds.jsonData.severityOverrides[0].name);
  await expect(row).toContainText(ds.name);
});

test('expanding a problem loads its details through the data source', async ({
  readProvisionedDataSource,
  readProvisionedDashboard,
  gotoDashboardPage,
  page,
}) => {
  const ds = await readProvisionedDataSource({ fileName: PROVISIONED_FILE, name: DS_NAME });
  const dashboard = await readProvisionedDashboard({ fileName: DASHBOARD_FILE });

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();

  const alertGetRequest = page.waitForRequest(
    (request) => isZabbixApi(request.url()) && isMethod(request.postData(), 'alert.get'),
    { timeout: 20000 }
  );
  const panel = page.getByRole('region', { name: 'Problems table via data source variable' });
  await panel.getByRole('row').filter({ hasText: PROBLEM }).locator('button:has(i.fa-info-circle)').click();

  // The details fetch the problem's alerts from the data source instance
  const response = await (await alertGetRequest).response();
  expect(response?.status()).toBe(200);
  await expect(panel.locator('.problem-details-container')).toContainText(ds.name);
});

test('list shows the data source name and global severity', async ({
  readProvisionedDataSource,
  readProvisionedDashboard,
  gotoDashboardPage,
  page,
}) => {
  const ds = await readProvisionedDataSource<SeverityOverridesJsonData>({ fileName: PROVISIONED_FILE, name: DS_NAME });
  const dashboard = await readProvisionedDashboard({ fileName: DASHBOARD_FILE });

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();

  const card = page.getByRole('region', { name: 'Problems list' }).getByRole('listitem').filter({ hasText: PROBLEM });
  await expect(card).toContainText(ds.jsonData.severityOverrides[0].name);
  await expect(card).toContainText(ds.name);
});
