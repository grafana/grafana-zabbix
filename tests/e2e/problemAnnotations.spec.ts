import { test, expect } from '@grafana/plugin-e2e';

/**
 * End-to-end tests for panel problem annotations, against the real provisioned
 * Zabbix backend.
 *
 * seed.sql gives item "E2E item 0" (itemid 9000001) one trigger, "E2E problem 0 on
 * {HOST.NAME}", with an open problem from about five minutes before the stack
 * started. The dashboards use a 24h range, so that problem is the only one in
 * range. They query the item by ID, which Metrics and Item ID queries share the
 * annotation code for, so the tests don't depend on the host's monitoring status.
 *
 * Requires the e2e environment (docker-compose.yml) with seeded fixtures.
 */

const isZabbixApi = (url: string) => url.includes('/resources/zabbix-api');
const zabbixMethod = (postData: string | null) => {
  try {
    return JSON.parse(postData ?? '').method as string | undefined;
  } catch {
    return undefined;
  }
};

test('a query with problem annotations marks its own panel only', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  selectors,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'problem-annotations.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();

  const markers = (title: string) =>
    dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Annotations.marker, {
      root: dashboardPage.getPanelByTitle(title).locator,
    });

  await expect(markers('Annotations on').first()).toBeVisible({ timeout: 20000 });
  await expect(markers('Annotations off')).toHaveCount(0);
  await expect(markers('Trigger filter matches nothing')).toHaveCount(0);
});

test('a dashboard without problem annotations makes no extra Zabbix API calls', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const methods: string[] = [];
  page.on('request', (request) => {
    if (isZabbixApi(request.url())) {
      methods.push(zabbixMethod(request.postData()) ?? 'unknown');
    }
  });

  const dashboard = await readProvisionedDashboard({ fileName: 'problem-annotations-off.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();
  await expect(dashboardPage.getPanelByTitle('Annotations off').locator).toBeVisible();

  expect(methods).not.toContain('trigger.get');
  expect(methods).not.toContain('event.get');
});

test('turning on problem annotations in the query editor lists the item triggers and marks the panel', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  selectors,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'problem-annotations-off.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });

  await page.getByRole('button', { name: 'Problem annotations' }).click();

  const eventsRequest = page.waitForRequest(
    (request) => isZabbixApi(request.url()) && zabbixMethod(request.postData()) === 'event.get',
    { timeout: 20000 }
  );
  await page.getByRole('switch', { name: /Show problems as annotations/i }).check({ force: true });

  // The trigger filter counts the triggers of the query's items
  await expect(page.getByTestId('annotation-trigger-match-count')).toHaveText('1 of 1 triggers', { timeout: 20000 });

  // Problems and recoveries come from a single event.get for the item's trigger
  const body = JSON.parse((await eventsRequest).postData()!);
  expect(body.params.value).toEqual(['0', '1']);
  expect(body.params.objectids).toEqual(['9000001']);

  await expect(
    panelEditPage
      .getByGrafanaSelector(selectors.pages.Dashboard.Annotations.marker, {
        root: panelEditPage.panel.locator,
      })
      .first()
  ).toBeVisible({ timeout: 20000 });
});
