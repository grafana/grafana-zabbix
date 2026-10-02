import { test, expect } from '@grafana/plugin-e2e';

/**
 * End-to-end regression test for the support escalation where a trigger with
 * "PROBLEM event generation mode = Multiple" opened three problems within the
 * same second (clock), each from a different item value. With "Item value at
 * problem time" enabled the plugin must resolve {ITEM.VALUE} per problem using
 * sub-second (clock + ns) ordering, not just clock: comparing on clock alone
 * cannot tell the three events apart, and matched every one of them to the
 * last history value in that second.
 *
 * Fixture (tests/fixtures/multiple-problem-events.sql): one trigger whose
 * comments are "Value received: {ITEM.VALUE} / Last value received:
 * {ITEM.LASTVALUE}", with three open problems from values 9, 2 and 6, all
 * landing in the same clock second but ordered by ns.
 *
 * Requires the e2e environment (docker-compose.yml) with seeded fixtures.
 */

const RAW_MACRO = '{ITEM.VALUE}';

test('resolves {ITEM.VALUE} per problem when several events from one trigger land in the same second', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'problems-multi-event-macros.json' });

  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.waitForPanelsQueriesToComplete();

  const panel = page.getByRole('region', { name: 'Problems from a Multiple PROBLEM events trigger' });
  const rows = panel.getByRole('row').filter({ hasText: 'E2E multi-event trigger' });
  await expect(rows).toHaveCount(3);

  for (let i = 0; i < 3; i++) {
    await rows.nth(i).locator('button:has(i.fa-info-circle)').click();
  }

  // Each of the three problems must show the value that generated it, not the
  // trigger's single most recent value (the original bug: all three showed "6").
  await expect(panel).toContainText('Value received: 9 / Last value received:');
  await expect(panel).toContainText('Value received: 2 / Last value received:');
  await expect(panel).toContainText('Value received: 6 / Last value received:');
  await expect(panel).not.toContainText(RAW_MACRO);
});
