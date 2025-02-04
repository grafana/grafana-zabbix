import { test, expect } from '@grafana/plugin-e2e';

test('Smoke test: plugin loads', async ({ createDataSourceConfigPage, page }) => {
  await createDataSourceConfigPage({ type: 'alexanderzobnin-zabbix-datasource' });

  await expect(await page.getByText('Type: Zabbix', { exact: true })).toBeVisible();
  await expect(await page.getByRole('heading', { name: 'Connection', exact: true })).toBeVisible();
});
