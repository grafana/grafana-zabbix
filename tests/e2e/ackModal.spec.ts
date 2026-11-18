import { expect, test } from '@grafana/plugin-e2e';
import { Page } from '@playwright/test';

/**
 * End-to-end tests for the Problems panel acknowledge dialog plumbing:
 *
 *  - the problem action buttons expose accessible names (aria-labels), and
 *  - the dialog survives a panel refresh: ModalController used to remount the
 *    modal on every parent re-render (new provideTheme() wrapper type per
 *    render), so a dashboard refresh while the dialog was open dropped its
 *    state and could dismiss it.
 *
 * Read-only: the dialog is never submitted, so the seeded fixture is untouched.
 * The assertions are also state-agnostic (message input + dialog only), so the
 * spec keeps passing on branches where the dialog's actions are state-gated
 * and other specs mutate problem state concurrently.
 */

const PROBLEM_NAME = 'E2E problem 1 on e2e-fixture-host';

const expandProblem = async (page: Page, problemName: string) => {
  const row = page.getByRole('row').filter({ hasText: problemName }).first();
  await row.locator('td.custom-expander button').click();
};

const gotoProblemsDashboard = async ({ gotoDashboardPage, readProvisionedDashboard }, queryParams?: URLSearchParams) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'problems-disabled.json' });
  const dashboardPage = await gotoDashboardPage({ uid: dashboard.uid, queryParams });
  await dashboardPage.waitForPanelsQueriesToComplete();
  return dashboardPage;
};

const isProblemsQuery = (url: string, postData: string | null | undefined) =>
  url.includes('/resources/zabbix-api') && !!postData && postData.includes('"problem.get"');

test('problem action buttons expose accessible names', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  await gotoProblemsDashboard({ gotoDashboardPage, readProvisionedDashboard });
  await expandProblem(page, PROBLEM_NAME);

  await expect(page.getByRole('button', { name: 'Acknowledge problem' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Execute script' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore' })).toBeVisible();
});

test('acknowledge dialog stays open and keeps its state across a panel refresh', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  // Auto-refresh every 5s: the panel re-queries and re-renders while the
  // dialog is open, which used to remount the dialog and wipe its state.
  const dashboardPage = await gotoProblemsDashboard(
    { gotoDashboardPage, readProvisionedDashboard },
    new URLSearchParams({ refresh: '5s' })
  );
  await expandProblem(page, PROBLEM_NAME);

  await page.getByRole('button', { name: 'Acknowledge problem' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Message').fill('typed before refresh');

  // Wait for the next auto-refresh query to fire and complete
  await page.waitForRequest((request) => isProblemsQuery(request.url(), request.postData()), { timeout: 20000 });
  await dashboardPage.waitForPanelsQueriesToComplete();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder('Message')).toHaveValue('typed before refresh');

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});
