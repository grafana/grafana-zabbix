import { test, expect } from '@grafana/plugin-e2e';
import type { Locator, Page } from '@playwright/test';

/**
 * End-to-end tests for the Problems panel sound alerts feature.
 *
 * Editor surface: the "Sound alerts" category in the panel editor, with the
 * dependent options shown only while the feature is enabled and the custom
 * URL input shown only for the "Custom" sound type.
 *
 * Behavior: a dashboard provisioned with sound alerts enabled
 * (problems-sound.json, highlightNewerThan=90d so the seeded fixture problems
 * count as "new") must create a Web Audio context exactly once on load and
 * must not play again on a refresh that brings no new problems.
 *
 * Requires the e2e environment (docker-compose) with seeded fixtures.
 */

// Count AudioContext instantiations before any page script runs. The built-in
// tones are played through the Web Audio API, one context per playback.
async function instrumentAudio(page: Page) {
  await page.addInitScript(() => {
    (window as any).__audioContextCount = 0;
    const OriginalAudioContext = window.AudioContext;
    (window as any).AudioContext = class extends OriginalAudioContext {
      constructor(...args: any[]) {
        super(...(args as []));
        (window as any).__audioContextCount++;
      }
    };
  });
}

const audioContextCount = (page: Page) => page.evaluate(() => (window as any).__audioContextCount as number);

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
  test('plays a tone once for new problems and not again on refresh', async ({
    gotoDashboardPage,
    readProvisionedDashboard,
    page,
  }) => {
    await instrumentAudio(page);

    const dashboard = await readProvisionedDashboard({ fileName: 'problems-sound.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);
    await dashboardPage.waitForPanelsQueriesToComplete();

    // The seeded fixture problems are High severity and within the 90d
    // "new problem" window, so the panel must play the tone exactly once.
    await expect.poll(() => audioContextCount(page), { timeout: 15000 }).toBe(1);

    // A refresh without new problems must not play again (soundRepeat is off).
    await dashboardPage.refreshDashboard();
    await dashboardPage.waitForPanelsQueriesToComplete();
    await page.waitForTimeout(1500);
    expect(await audioContextCount(page)).toBe(1);
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
    await page.waitForTimeout(1500);

    expect(await audioContextCount(page)).toBe(0);
  });
});
