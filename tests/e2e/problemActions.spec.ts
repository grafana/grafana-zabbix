import { expect, test } from '@grafana/plugin-e2e';
import { Page } from '@playwright/test';

/**
 * End-to-end tests for the Problems panel user actions against the real
 * provisioned Zabbix backend (7.0 by default, which supports every action):
 * acknowledge, unacknowledge, suppress (indefinite / duration / until date),
 * unsuppress, rank as cause and rank as symptom.
 *
 * The tests use the two seeded problems (tests/fixtures/seed.sql):
 *   - eventid 9000001 "E2E problem 0 on e2e-fixture-host"
 *   - eventid 9000002 "E2E problem 1 on e2e-fixture-host"
 *
 * Tests run serially and every mutation is paired with its inverse action
 * (ack -> unack, suppress -> unsuppress, rank symptom -> rank cause), so the
 * fixture ends in the same state it started and reruns stay deterministic.
 *
 * Zabbix processes suppression and rank changes asynchronously (task manager),
 * so state-flip assertions reload the dashboard until the new state is visible.
 */

test.describe.configure({ mode: 'serial' });

const DASHBOARD_FILE = 'problems-disabled.json';
// Same panel but with "Show hosts in maintenance" enabled, which also shows
// suppressed problems — needed to reach the Unsuppress action in the UI.
const DASHBOARD_SUPPRESSED_VISIBLE_FILE = 'problems-suppressed.json';

const CAUSE_PROBLEM = { eventid: '9000001', name: 'E2E problem 0 on e2e-fixture-host' };
const SYMPTOM_PROBLEM = { eventid: '9000002', name: 'E2E problem 1 on e2e-fixture-host' };
const CAUSE_OPTION_LABEL = `e2e-fixture-host: ${CAUSE_PROBLEM.name}`;
const SYMPTOM_OPTION_LABEL = `e2e-fixture-host: ${SYMPTOM_PROBLEM.name}`;

const isZabbixApi = (url: string) => url.includes('/resources/zabbix-api');
const isAcknowledge = (postData: string | null | undefined) => !!postData && postData.includes('"event.acknowledge"');

const modal = (page: Page) => page.getByRole('dialog');

const expandProblem = async (page: Page, problemName: string) => {
  const row = page.getByRole('row').filter({ hasText: problemName }).first();
  await row.locator('td.custom-expander button').click();
  await expect(page.getByRole('button', { name: 'Acknowledge problem' })).toBeVisible();
};

const openUpdateModal = async (page: Page) => {
  await page.getByRole('button', { name: 'Acknowledge problem' }).click();
  await expect(modal(page).getByText('Update Problem')).toBeVisible();
};

const gotoProblemsDashboard = async ({ gotoDashboardPage, readProvisionedDashboard }, fileName = DASHBOARD_FILE) => {
  const dashboard = await readProvisionedDashboard({ fileName });
  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();
  return dashboardPage;
};

const openModalForProblem = async (fixtures, page: Page, problemName: string, fileName = DASHBOARD_FILE) => {
  await gotoProblemsDashboard(fixtures, fileName);
  await expandProblem(page, problemName);
  await openUpdateModal(page);
};

const toggleAction = async (page: Page, label: string) => {
  await modal(page).getByText(label, { exact: true }).click();
};

// The radio inputs of RadioButtonGroup are visually hidden and intercept
// pointer events aimed at their labels, so click them directly.
const pickSuppressMode = async (page: Page, label: string) => {
  await modal(page).getByRole('radio', { name: label }).click({ force: true });
};

/** Click Update, capture the event.acknowledge request, and return its body and HTTP status. */
const submitAndCaptureAck = async (page: Page) => {
  const requestPromise = page.waitForRequest((r) => isZabbixApi(r.url()) && isAcknowledge(r.postData()), {
    timeout: 15000,
  });
  await modal(page).getByRole('button', { name: 'Update', exact: true }).click();
  const request = await requestPromise;
  const body = JSON.parse(request.postData()!);
  const response = await request.response();
  // Zabbix accepted the action: modal submits successfully and closes
  await expect(modal(page)).toBeHidden({ timeout: 15000 });
  return { params: body.params, status: response?.status() };
};

/**
 * Reload the dashboard and open the problem's update modal until the expected
 * actions are offered. Retries because Zabbix applies suppression and rank
 * changes asynchronously via its task manager.
 */
const expectModalActionsEventually = async (
  fixtures,
  page: Page,
  problemName: string,
  visible: string[],
  hidden: string[],
  fileName = DASHBOARD_FILE
) => {
  await expect(async () => {
    await openModalForProblem(fixtures, page, problemName, fileName);
    for (const label of visible) {
      await expect(modal(page).getByText(label, { exact: true })).toBeVisible({ timeout: 3000 });
    }
    for (const label of hidden) {
      await expect(modal(page).getByText(label, { exact: true })).toBeHidden();
    }
  }).toPass({ timeout: 90000, intervals: [2000, 3000, 5000, 5000, 10000] });
};

/** Reload the dashboard until the problem row is (or is no longer) listed. */
const expectProblemListedEventually = async (fixtures, page: Page, problemName: string, listed: boolean) => {
  await expect(async () => {
    await gotoProblemsDashboard(fixtures);
    const row = page.getByRole('row').filter({ hasText: problemName }).first();
    if (listed) {
      await expect(row).toBeVisible({ timeout: 3000 });
    } else {
      await expect(row).toBeHidden({ timeout: 3000 });
    }
  }).toPass({ timeout: 90000, intervals: [2000, 3000, 5000, 5000, 10000] });
};

test('offers only the state-appropriate actions for a fresh problem', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  await openModalForProblem({ gotoDashboardPage, readProvisionedDashboard }, page, CAUSE_PROBLEM.name);

  for (const label of ['Acknowledge', 'Change severity', 'Suppress', 'Rank as symptom']) {
    await expect(modal(page).getByText(label, { exact: true })).toBeVisible();
  }
  // Not acknowledged, not suppressed, already a cause, trigger has no manual close
  for (const label of ['Unacknowledge', 'Unsuppress', 'Rank as cause', 'Close problem']) {
    await expect(modal(page).getByText(label, { exact: true })).toBeHidden();
  }
});

test('rejects invalid suppress durations and dates without calling the API', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  let acknowledgeRequests = 0;
  page.on('request', (request) => {
    if (isZabbixApi(request.url()) && isAcknowledge(request.postData())) {
      acknowledgeRequests++;
    }
  });

  await openModalForProblem({ gotoDashboardPage, readProvisionedDashboard }, page, CAUSE_PROBLEM.name);
  await toggleAction(page, 'Suppress');

  // Invalid date format: live error, submit blocked
  await pickSuppressMode(page, 'Until date');
  await modal(page).getByLabel('Suppress until date').fill('31/12/2100');
  await expect(modal(page).getByText('Invalid date. Use format YYYY-MM-DD HH:mm.')).toBeVisible();
  await modal(page).getByRole('button', { name: 'Update', exact: true }).click();
  await expect(modal(page).getByText('Update Problem')).toBeVisible();

  // Past date: live error, submit blocked
  await modal(page).getByLabel('Suppress until date').fill('2000-01-01 00:00');
  await expect(modal(page).getByText('Suppress until date must be in the future.')).toBeVisible();
  await modal(page).getByRole('button', { name: 'Update', exact: true }).click();
  await expect(modal(page).getByText('Update Problem')).toBeVisible();

  // Invalid duration: live error, submit blocked
  await pickSuppressMode(page, 'For duration');
  await modal(page).getByLabel('Suppress duration').fill('not-a-duration');
  await expect(modal(page).getByText('Invalid suppress duration. Use values like 30m, 1h or 2d.')).toBeVisible();
  await modal(page).getByRole('button', { name: 'Update', exact: true }).click();
  await expect(modal(page).getByText('Update Problem')).toBeVisible();

  await page.waitForTimeout(1000);
  expect(acknowledgeRequests).toBe(0);
});

test('acknowledges a problem and then offers unacknowledge', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const fixtures = { gotoDashboardPage, readProvisionedDashboard };
  await openModalForProblem(fixtures, page, CAUSE_PROBLEM.name);

  await modal(page).getByPlaceholder('Message').fill('e2e: acknowledge');
  await toggleAction(page, 'Acknowledge');
  const { params, status } = await submitAndCaptureAck(page);

  expect(status).toBe(200);
  expect(params.eventids).toBe(CAUSE_PROBLEM.eventid);
  // add message (4) + acknowledge (2)
  expect(params.action).toBe(6);
  expect(params.message).toContain('e2e: acknowledge');

  await expectModalActionsEventually(fixtures, page, CAUSE_PROBLEM.name, ['Unacknowledge'], ['Acknowledge']);
});

test('unacknowledges the problem and then offers acknowledge again', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const fixtures = { gotoDashboardPage, readProvisionedDashboard };
  await openModalForProblem(fixtures, page, CAUSE_PROBLEM.name);

  await toggleAction(page, 'Unacknowledge');
  const { params, status } = await submitAndCaptureAck(page);

  expect(status).toBe(200);
  expect(params.eventids).toBe(CAUSE_PROBLEM.eventid);
  // unacknowledge (16) + always-on add message (4)
  expect(params.action).toBe(20);

  await expectModalActionsEventually(fixtures, page, CAUSE_PROBLEM.name, ['Acknowledge'], ['Unacknowledge']);
});

test('suppresses a problem indefinitely, hiding it from the default panel', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const fixtures = { gotoDashboardPage, readProvisionedDashboard };
  await openModalForProblem(fixtures, page, CAUSE_PROBLEM.name);

  await toggleAction(page, 'Suppress');
  const { params, status } = await submitAndCaptureAck(page);

  expect(status).toBe(200);
  expect(params.eventids).toBe(CAUSE_PROBLEM.eventid);
  // suppress (32) + always-on add message (4)
  expect(params.action).toBe(36);
  expect(params.suppress_until).toBe(0);

  // Suppressed problems are hidden from the panel unless the query opts in
  await expectProblemListedEventually(fixtures, page, CAUSE_PROBLEM.name, false);
  // On a panel which shows suppressed problems the update modal now offers Unsuppress
  await expectModalActionsEventually(
    fixtures,
    page,
    CAUSE_PROBLEM.name,
    ['Unsuppress'],
    ['Suppress'],
    DASHBOARD_SUPPRESSED_VISIBLE_FILE
  );
});

test('unsuppresses the problem, bringing it back to the default panel', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const fixtures = { gotoDashboardPage, readProvisionedDashboard };
  await openModalForProblem(fixtures, page, CAUSE_PROBLEM.name, DASHBOARD_SUPPRESSED_VISIBLE_FILE);

  await toggleAction(page, 'Unsuppress');
  const { params, status } = await submitAndCaptureAck(page);

  expect(status).toBe(200);
  expect(params.eventids).toBe(CAUSE_PROBLEM.eventid);
  // unsuppress (64) + always-on add message (4)
  expect(params.action).toBe(68);

  await expectProblemListedEventually(fixtures, page, CAUSE_PROBLEM.name, true);
  await expectModalActionsEventually(fixtures, page, CAUSE_PROBLEM.name, ['Suppress'], ['Unsuppress']);
});

test('ranks a problem as symptom via the cause event dropdown', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const fixtures = { gotoDashboardPage, readProvisionedDashboard };
  await openModalForProblem(fixtures, page, SYMPTOM_PROBLEM.name);

  await toggleAction(page, 'Rank as symptom');
  await modal(page).getByLabel('Cause event').click();
  // The dropdown offers other cause problems from the panel, not the problem itself
  await expect(page.getByText(CAUSE_OPTION_LABEL, { exact: true })).toBeVisible();
  await expect(page.getByText(SYMPTOM_OPTION_LABEL, { exact: true })).toBeHidden();
  await page.getByText(CAUSE_OPTION_LABEL, { exact: true }).click();

  const { params, status } = await submitAndCaptureAck(page);

  expect(status).toBe(200);
  expect(params.eventids).toBe(SYMPTOM_PROBLEM.eventid);
  // rank as symptom (256) + always-on add message (4)
  expect(params.action).toBe(260);
  expect(params.cause_eventid).toBe(CAUSE_PROBLEM.eventid);

  await expectModalActionsEventually(fixtures, page, SYMPTOM_PROBLEM.name, ['Rank as cause'], ['Rank as symptom']);
});

test('ranks the symptom back as cause', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
  const fixtures = { gotoDashboardPage, readProvisionedDashboard };
  await openModalForProblem(fixtures, page, SYMPTOM_PROBLEM.name);

  await toggleAction(page, 'Rank as cause');
  const { params, status } = await submitAndCaptureAck(page);

  expect(status).toBe(200);
  expect(params.eventids).toBe(SYMPTOM_PROBLEM.eventid);
  // rank as cause (128) + always-on add message (4)
  expect(params.action).toBe(132);

  await expectModalActionsEventually(fixtures, page, SYMPTOM_PROBLEM.name, ['Rank as symptom'], ['Rank as cause']);
});
