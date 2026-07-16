import { test, expect } from '@grafana/plugin-e2e';

/**
 * End-to-end test for issue #2427, against the real provisioned Zabbix backend.
 *
 * The Problems panel can resolve each problem's item value at its creation time
 * via a history.get call ("Item value at problem time" option). This is off by
 * default. The fixture seeds an open problem backdated ~30 days, so:
 *
 *   - With the option OFF (default) the panel must send NO history.get at all.
 *   - With the option ON the history.get must be BOUNDED: a hard row `limit` and
 *     a capped time-window span — the 30-day-old problem must NOT widen the query
 *     to a 30-day scan (which overloaded the Zabbix frontend/DB before the fix).
 *
 * Requires the e2e environment (docker-compose.e2e.yaml) with seeded fixtures.
 */

// Must mirror the bounds in src/datasource/zabbix/zabbix.ts
const MAX_HISTORY_WINDOW_SECONDS = 4 * 3600;
const HISTORY_LOOKBACK_SECONDS = 3600;
const HISTORY_FETCH_LIMIT = 50000;

const isZabbixApi = (url: string) => url.includes('/resources/zabbix-api');
const isHistoryGet = (postData: string | null) => !!postData && postData.includes('"history.get"');

test('Problems panel does not call history.get when the option is disabled (default)', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'problems-disabled.json' });

  let sawHistoryGet = false;
  page.on('request', (request) => {
    if (isZabbixApi(request.url()) && isHistoryGet(request.postData())) {
      sawHistoryGet = true;
    }
  });

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();
  await page.waitForTimeout(1500);

  expect(sawHistoryGet).toBe(false);
});

test('Problems panel issues a bounded history.get when the option is enabled', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'problems-enabled.json' });

  const historyGetRequest = page.waitForRequest(
    (request) => isZabbixApi(request.url()) && isHistoryGet(request.postData()),
    { timeout: 20000 }
  );

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();

  const request = await historyGetRequest;
  const body = JSON.parse(request.postData()!);

  expect(body.method).toBe('history.get');
  // A hard row cap must be sent to Zabbix.
  expect(body.params.limit).toBe(HISTORY_FETCH_LIMIT);
  // The 30-day-old open problem must NOT widen the window to ~30 days.
  const span = body.params.time_till - body.params.time_from;
  expect(span).toBeLessThanOrEqual(MAX_HISTORY_WINDOW_SECONDS + HISTORY_LOOKBACK_SECONDS + 120);

  // The bounded call must actually succeed against Zabbix (not 500/timeout).
  const response = await request.response();
  expect(response?.status()).toBe(200);
});
