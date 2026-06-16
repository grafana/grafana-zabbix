import { test, expect } from '@grafana/plugin-e2e';

test('Smoke test: plugin loads', async ({ createDataSourceConfigPage, page }) => {
  await createDataSourceConfigPage({ type: 'alexanderzobnin-zabbix-datasource' });

  await expect(page.getByRole('heading', { name: 'Zabbix Connection' })).toBeVisible();
});
