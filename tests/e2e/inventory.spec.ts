import { test, expect } from '@grafana/plugin-e2e';

/**
 * End-to-end test for the Inventory query type (issue #280), against the real
 * provisioned Zabbix backend seeded by tests/fixtures/inventory.sql:
 *
 *   - e2e-inv-santiago: dot-decimal coordinates,
 *   - e2e-inv-madrid:   decimal-comma coordinates (must still parse),
 *   - e2e-inv-disabled: inventory disabled (row present, fields empty).
 *
 * Requires the e2e environment (docker-compose.yml) with seeded fixtures.
 */

const isZabbixApi = (url: string) => url.includes('/resources/zabbix-api');
const isMethod = (postData: string | null, method: string) => !!postData && postData.includes(`"${method}"`);

test('returns host inventory with numeric coordinates for Geomap', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'inventory-geomap.json' });

  const inventoryRequest = page.waitForRequest(
    (request) =>
      isZabbixApi(request.url()) &&
      isMethod(request.postData(), 'host.get') &&
      (request.postData() || '').includes('selectInventory'),
    { timeout: 20000 }
  );

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();
  await inventoryRequest;

  const table = page.getByRole('region', { name: 'Host inventory' });
  await expect(table.getByRole('row').filter({ hasText: 'e2e-inv-santiago' })).toContainText('-33.4');
  await expect(table.getByRole('row').filter({ hasText: 'e2e-inv-madrid' })).toContainText('40.4');
  await expect(table.getByRole('row').filter({ hasText: 'e2e-inv-disabled' })).toBeVisible();

  const geomap = page.getByRole('region', { name: 'Hosts by inventory location' });
  await expect(geomap.locator('canvas').first()).toBeVisible();
});
