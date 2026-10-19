import { test, expect } from '@grafana/plugin-e2e';

/**
 * End-to-end test for trigger Description macro expansion, against the real
 * provisioned Zabbix backend.
 *
 * The Problems panel shows the Zabbix trigger `comments` field as "Description".
 * The fixture seeds a trigger whose comments are `Current value: {ITEM.VALUE}`
 * and one open problem on an item whose value is 42, so:
 *
 *   - With "Item value at problem time" OFF (default) Zabbix must expand the
 *     macro server-side, and the panel must show a value rather than the macro.
 *   - With it ON the plugin expands the macro itself, per problem, so the
 *     request must NOT carry expandComment — Zabbix treats that key as
 *     present-means-true and would expand the comment before the plugin sees it.
 *
 * Requires the e2e environment (docker-compose.yml) with seeded fixtures.
 */

const EXPANDED_DESCRIPTION = 'Current value: 42';
const RAW_MACRO = '{ITEM.VALUE}';

const isZabbixApi = (url: string) => url.includes('/resources/zabbix-api');
const isMethod = (postData: string | null, method: string) => !!postData && postData.includes(`"${method}"`);

const triggerGetParams = (postData: string) => {
  const body = JSON.parse(postData);
  return (body.params ?? body.data?.params) as Record<string, unknown>;
};

test('expands the Description macro without a history lookup by default', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'problems-description-macros.json' });

  const triggerGetRequest = page.waitForRequest(
    (request) => isZabbixApi(request.url()) && isMethod(request.postData(), 'trigger.get'),
    { timeout: 20000 }
  );
  let sawHistoryGet = false;
  page.on('request', (request) => {
    if (isZabbixApi(request.url()) && isMethod(request.postData(), 'history.get')) {
      sawHistoryGet = true;
    }
  });

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();

  // Zabbix must be asked to expand the comment, so the fix costs no extra request.
  const params = triggerGetParams((await triggerGetRequest).postData()!);
  expect(params.expandComment).toBe(true);

  const panel = page.getByRole('region', { name: 'Problems with macro in Description' });
  await panel.getByRole('row').filter({ hasText: 'E2E macro trigger' }).locator('button:has(i.fa-info-circle)').click();

  await expect(panel).toContainText(EXPANDED_DESCRIPTION);
  await expect(panel).not.toContainText(RAW_MACRO);
  expect(sawHistoryGet).toBe(false);
});

test('leaves the Description raw for the plugin to expand when the history lookup is enabled', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'problems-description-macros-enabled.json' });

  const triggerGetRequest = page.waitForRequest(
    (request) => isZabbixApi(request.url()) && isMethod(request.postData(), 'trigger.get'),
    { timeout: 20000 }
  );

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();

  // The key must be absent, not false: Zabbix expands the comment whenever the
  // key is present, which would leave the per-problem expansion nothing to replace.
  const params = triggerGetParams((await triggerGetRequest).postData()!);
  expect(params).not.toHaveProperty('expandComment');

  const panel = page.getByRole('region', { name: 'Problems with macro in Description (item value at problem time)' });
  await panel.getByRole('row').filter({ hasText: 'E2E macro trigger' }).locator('button:has(i.fa-info-circle)').click();

  await expect(panel).toContainText(EXPANDED_DESCRIPTION);
  await expect(panel).not.toContainText(RAW_MACRO);
});
