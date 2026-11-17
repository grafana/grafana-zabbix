import { test, expect } from '@grafana/plugin-e2e';
import type { Page } from '@playwright/test';

// Item tag AND/OR matching (issue #1286), against the tags in tests/fixtures/tags-item-evaltype.sql.
const DS_UID = 'zabbix-e2e';

const metricsQuery = {
  queryType: '0',
  group: { filter: 'E2E' },
  host: { filter: 'e2e-fixture-host' },
  application: { filter: '' },
  itemTag: { filter: 'e2e_a: x, e2e_b: x' },
  item: { filter: '/.*/' },
  functions: [],
  options: { showDisabledItems: false, skipEmptyValues: false, disableDataAlignment: false },
};

function exploreUrl(query: Record<string, unknown>) {
  const panes = {
    a: {
      datasource: DS_UID,
      queries: [{ refId: 'A', datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: DS_UID }, ...query }],
      range: { from: 'now-6h', to: 'now' },
    },
  };
  return `/explore?schemaVersion=1&orgId=1&panes=${encodeURIComponent(JSON.stringify(panes))}`;
}

// Item names in the next /api/ds/query response.
function nextQueryItems(page: Page) {
  return page
    .waitForResponse((res) => res.url().includes('/api/ds/query') && res.request().method() === 'POST', {
      timeout: 20000,
    })
    .then(async (res) => {
      expect(res.status()).toBe(200);
      const body = await res.text();
      return ['E2E item 0', 'E2E item 1'].filter((name) => body.includes(name));
    });
}

test('item tag list matches any tag by default and all tag names with AND/OR', async ({ page }) => {
  const orItems = nextQueryItems(page);
  await page.goto(exploreUrl(metricsQuery));
  expect(await orItems).toEqual(['E2E item 0', 'E2E item 1']);

  await expect(page.getByRole('radio', { name: 'OR', exact: true })).toBeChecked();

  const andItems = nextQueryItems(page);
  await page.getByRole('radio', { name: 'AND/OR' }).click();
  expect(await andItems).toEqual(['E2E item 0']);
});
