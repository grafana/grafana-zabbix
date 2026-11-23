import { test, expect } from '@grafana/plugin-e2e';
import type { Page } from '@playwright/test';

/**
 * Problems panel: the trigger description in an expanded problem row.
 *
 * The preview must wrap inside the details pane (the table cell sets nowrap) and fade
 * its last line only when it is cut off. Clicking it opens a modal with the full text
 * that can be copied to the clipboard.
 *
 * Uses the provisioned problems-enabled.json dashboard and the descriptions from
 * tests/fixtures/seed_problem_descriptions.sql.
 */

const DESCRIPTION_NAME = 'Open the full problem description';
const END_MARKER = 'E2E description end marker';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function expandProblem(page: Page, problemName: string) {
  const row = page.getByRole('row', { name: new RegExp(problemName) });
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.locator('button:has(i.fa-info-circle)').click();
  const description = page.getByRole('button', { name: DESCRIPTION_NAME });
  await expect(description).toBeVisible();
  return description;
}

const measure = (description: ReturnType<Page['getByRole']>) =>
  description.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      whiteSpace: style.whiteSpace,
      overflowsHorizontally: el.scrollWidth > el.clientWidth + 1,
      clippedVertically: el.scrollHeight > el.clientHeight + 1,
      mask: style.maskImage || style.webkitMaskImage || 'none',
    };
  });

test.describe('Problems panel description', () => {
  test.beforeEach(async ({ gotoDashboardPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'problems-enabled.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);
    await dashboardPage.waitForPanelsQueriesToComplete();
  });

  test('long description wraps in the preview and fades when cut off', async ({ page }) => {
    const description = await expandProblem(page, 'E2E problem 0');

    // The fade is applied after a layout measurement, so poll for the settled state.
    await expect
      .poll(() => measure(description))
      .toMatchObject({
        whiteSpace: 'normal',
        overflowsHorizontally: false,
        clippedVertically: true,
      });
    expect((await measure(description)).mask).toContain('linear-gradient');
  });

  test('short description wraps and is not faded', async ({ page }) => {
    const description = await expandProblem(page, 'E2E problem 1');

    await expect(description).toContainText('E2E short description.');
    await expect
      .poll(() => measure(description))
      .toMatchObject({
        whiteSpace: 'normal',
        overflowsHorizontally: false,
        clippedVertically: false,
        mask: 'none',
      });
  });

  test('hovering hints that the description opens on click', async ({ page }) => {
    const description = await expandProblem(page, 'E2E problem 0');

    await description.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Click to open the full description');
  });

  test('clicking the description opens a modal with the full text that can be copied', async ({ page }) => {
    const description = await expandProblem(page, 'E2E problem 0');

    await description.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Problem description' })).toBeVisible();
    await expect(dialog).toContainText('E2E problem 0 on e2e-fixture-host');
    await expect(dialog).toContainText('e2e-fixture-host');
    // The end of the description is hidden in the preview but readable in the modal.
    await expect(dialog.getByText(END_MARKER)).toBeVisible();

    await dialog.getByRole('button', { name: /Copy to clipboard/ }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.startsWith('E2E long description, line 1:')).toBe(true);
    expect(copied).toContain('\nLine 2:');
    expect(copied.endsWith(END_MARKER)).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('the description can be opened from the keyboard', async ({ page }) => {
    const description = await expandProblem(page, 'E2E problem 0');

    await description.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
