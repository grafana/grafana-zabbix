import { test, expect, DashboardPage } from '@grafana/plugin-e2e';
import type { Locator, Page } from '@playwright/test';

/**
 * End-to-end tests for the Problems panel sound alerts feature.
 *
 * Editor surface: the "Sound alerts" category in the panel editor, with the
 * dependent options shown only while the feature is enabled and the custom
 * URL input shown only for the "Custom" sound type.
 *
 * Behavior, against dashboards provisioned with sound alerts enabled
 * (problems-sound*.json, highlightNewerThan=90d so the seeded fixture problems
 * stay inside the "new problem" window):
 *
 *   - The first completed refresh seeds the known problems silently, so a
 *     reload never replays the problems already on screen.
 *   - While the page has had no user interaction the AudioContext is suspended
 *     by autoplay policy and playback is skipped with a console warning.
 *   - After a user gesture, "Repeat while active" plays on refresh cycles as
 *     long as matching problems persist.
 *
 * Requires the e2e environment (docker-compose) with seeded fixtures.
 */

// Count actual playbacks: an oscillator is only created after the suspended
// check passes, so this counts audible tones rather than context creations.
async function instrumentAudio(page: Page) {
  await page.addInitScript(() => {
    (window as any).__oscillatorCount = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args: []) {
      (window as any).__oscillatorCount++;
      return original.apply(this, args);
    };
  });
}

const playbackCount = (page: Page) => page.evaluate(() => (window as any).__oscillatorCount as number);

// A trusted user gesture that unlocks audio without changing any state:
// open the time picker and close it again.
async function userGesture(dashboardPage: DashboardPage, page: Page) {
  await dashboardPage.getByGrafanaSelector(dashboardPage.ctx.selectors.components.TimePicker.openButton).click();
  await page.keyboard.press('Escape');
}

async function refreshAndWait(dashboardPage: DashboardPage, page: Page) {
  await dashboardPage.refreshDashboard();
  await dashboardPage.waitForPanelsQueriesToComplete();
  await page.waitForTimeout(500);
}

test.describe('Problems panel sound alert editor options', () => {
  test('sound alert options are revealed by the enable switch and the custom sound type', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
    selectors,
    page,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'problems-enabled.json' });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });

    const field = (optionName: string): Locator =>
      panelEditPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel(`Sound alerts ${optionName}`)
      );

    // The category exists and the feature is disabled by default, so only the
    // enable switch is visible.
    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.OptionsGroup.group('Sound alerts'))
    ).toBeVisible();
    await expect(field('Enable sound alerts')).toBeVisible();
    await expect(field('Minimum severity')).toBeHidden();
    await expect(field('Sound type')).toBeHidden();
    await expect(field('Audio file URL')).toBeHidden();
    await expect(field('Volume (%)')).toBeHidden();
    await expect(field('Repeat while active')).toBeHidden();

    // Enabling the feature reveals the dependent options, but not the custom
    // URL input while a built-in tone is selected.
    await field('Enable sound alerts').locator('input[type="checkbox"]').check({ force: true });
    await expect(field('Minimum severity')).toBeVisible();
    await expect(field('Sound type')).toBeVisible();
    await expect(field('Volume (%)')).toBeVisible();
    await expect(field('Repeat while active')).toBeVisible();
    await expect(field('Audio file URL')).toBeHidden();

    // The severity threshold offers all six Zabbix severities.
    await field('Minimum severity').locator('input').click();
    await expect(panelEditPage.getByGrafanaSelector(selectors.components.Select.option)).toHaveText([
      'Not classified',
      'Information',
      'Warning',
      'Average',
      'High',
      'Disaster',
    ]);
    await page.keyboard.press('Escape');

    // Selecting the "Custom" sound type reveals the audio URL input.
    await field('Sound type').locator('input').click();
    await panelEditPage.getByGrafanaSelector(selectors.components.Select.option).getByText('Custom').click();
    await expect(field('Audio file URL')).toBeVisible();

    // And switching back to a built-in tone hides it again.
    await field('Sound type').locator('input').click();
    await panelEditPage.getByGrafanaSelector(selectors.components.Select.option).getByText('Alarm').click();
    await expect(field('Audio file URL')).toBeHidden();
  });
});

test.describe('Problems panel sound alert playback', () => {
  test('seeds the problems on screen silently and does not replay them on refresh', async ({
    gotoDashboardPage,
    readProvisionedDashboard,
    page,
  }) => {
    await instrumentAudio(page);

    const dashboard = await readProvisionedDashboard({ fileName: 'problems-sound.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);
    await dashboardPage.waitForPanelsQueriesToComplete();
    await page.waitForTimeout(1000);

    // The seeded fixture problems are already on screen on the first refresh,
    // so they are known, not new: nothing plays on load.
    expect(await playbackCount(page)).toBe(0);

    // Unlock audio so a skip cannot be mistaken for the suspended context.
    await userGesture(dashboardPage, page);
    await refreshAndWait(dashboardPage, page);

    // No new problems and repeat is off: still silent.
    expect(await playbackCount(page)).toBe(0);
  });

  test('repeat mode plays on refresh cycles while matching problems persist', async ({
    gotoDashboardPage,
    readProvisionedDashboard,
    page,
  }) => {
    await instrumentAudio(page);

    const dashboard = await readProvisionedDashboard({ fileName: 'problems-sound-repeat.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);
    await dashboardPage.waitForPanelsQueriesToComplete();
    await page.waitForTimeout(1000);

    // First refresh seeds silently even in repeat mode.
    expect(await playbackCount(page)).toBe(0);

    // Unlock audio for browsers that enforce the autoplay policy (headed
    // runs; headless Chromium does not enforce it). The resume after the
    // gesture is asynchronous, so allow a few refresh cycles for the first
    // tone. The suspended-skip itself is covered by unit tests.
    await userGesture(dashboardPage, page);
    await expect
      .poll(
        async () => {
          await refreshAndWait(dashboardPage, page);
          return playbackCount(page);
        },
        { timeout: 30000 }
      )
      .toBeGreaterThanOrEqual(1);

    // And with matching problems persisting, every refresh plays again.
    const before = await playbackCount(page);
    await refreshAndWait(dashboardPage, page);
    expect(await playbackCount(page)).toBeGreaterThan(before);
  });

  test('does not play when sound alerts are disabled', async ({
    gotoDashboardPage,
    readProvisionedDashboard,
    page,
  }) => {
    await instrumentAudio(page);

    const dashboard = await readProvisionedDashboard({ fileName: 'problems-enabled.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);
    await dashboardPage.waitForPanelsQueriesToComplete();
    await page.waitForTimeout(1000);

    expect(await playbackCount(page)).toBe(0);
  });
});
