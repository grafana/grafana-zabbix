import { test, expect } from '@grafana/plugin-e2e';

/**
 * End-to-end tests for problem tag filters against the real provisioned Zabbix
 * backend, covering the structured tag filters introduced with query schema 13.
 *
 * The tag-filter.sql fixture tags the seeded problems:
 *   - "E2E problem 0" (eventid 9000001): environment:production, service:web
 *   - "E2E problem 1" (eventid 9000002): environment:staging
 *
 * Backward compatibility: a dashboard saved BEFORE schema 13 (free-text
 * `tags.filter`, no `problemTags`) must keep working unchanged — the target is
 * migrated on the fly at query time and must send the exact same problem.get
 * `tags` param the legacy code sent (operator 1 = Equal), without modifying the
 * stored dashboard.
 *
 * Requires the e2e environment (docker-compose.yml) with seeded fixtures.
 */

const isZabbixApi = (url: string) => url.includes('/resources/zabbix-api');
const isProblemGet = (postData: string | null) => !!postData && postData.includes('"problem.get"');

test('legacy dashboard with a free-text tag filter keeps working (schema < 13)', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'problems-legacy-tags.json' });

  const problemGetRequest = page.waitForRequest(
    (request) => isZabbixApi(request.url()) && isProblemGet(request.postData()),
    { timeout: 20000 }
  );

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();

  // The legacy text filter must reach Zabbix as the exact tags param the old
  // implementation sent: parsed pairs with operator 1 (Equal).
  const request = await problemGetRequest;
  const body = JSON.parse(request.postData()!);
  expect(body.method).toBe('problem.get');
  expect(body.params.tags).toEqual([{ tag: 'environment', value: 'production', operator: 1 }]);

  const response = await request.response();
  expect(response?.status()).toBe(200);

  // The panel must show only the problem tagged environment:production.
  await expect(page.getByText('E2E problem 0 on e2e-fixture-host').first()).toBeVisible();
  await expect(page.getByText('E2E problem 1 on e2e-fixture-host')).toHaveCount(0);
});

test('structured tag filter with an extended operator (Exists) filters at the source', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'problems-structured-tags.json' });

  const problemGetRequest = page.waitForRequest(
    (request) => isZabbixApi(request.url()) && isProblemGet(request.postData()),
    { timeout: 20000 }
  );

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();

  // Operator 4 (Exists) must be sent as-is, without a value.
  const request = await problemGetRequest;
  const body = JSON.parse(request.postData()!);
  expect(body.method).toBe('problem.get');
  expect(body.params.tags).toEqual([{ tag: 'service', operator: 4 }]);

  // Zabbix must accept the extended operator (5.4+), not reject the request.
  const response = await request.response();
  expect(response?.status()).toBe(200);

  // Only problem 0 carries a "service" tag.
  await expect(page.getByText('E2E problem 0 on e2e-fixture-host').first()).toBeVisible();
  await expect(page.getByText('E2E problem 1 on e2e-fixture-host')).toHaveCount(0);
});
