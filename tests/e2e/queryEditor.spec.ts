import { test, expect } from '@grafana/plugin-e2e';

const DS_NAME = 'Zabbix E2E';
const DS_UID = 'zabbix-e2e';

const isZabbixApi = (url: string) => url.includes('/resources/zabbix-api');

// Build an Explore URL with a pre-set query for the provisioned datasource,
// so query-execution tests don't depend on driving the filter comboboxes.
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

const problemsQuery = {
  queryType: '5',
  showProblems: 'problems',
  resultFormat: 'table',
  evaltype: '0',
  group: { filter: '' },
  host: { filter: '' },
  application: { filter: '' },
  proxy: { filter: '' },
  trigger: { filter: '' },
  tags: { filter: '' },
  item: { filter: '' },
  itemTag: { filter: '' },
  macro: { filter: '' },
  options: { acknowledged: 2, minSeverity: 0, count: false, limit: 1001, useTimeRange: false },
};

test.describe('Query editor', () => {
  test('smoke: renders the query editor', { tag: '@plugins' }, async ({ explorePage, page }) => {
    await explorePage.datasource.set(DS_NAME);
    await expect(page.getByText('Query type')).toBeVisible();
  });

  test('renders the metrics filter fields', async ({ explorePage, page }) => {
    await explorePage.datasource.set(DS_NAME);
    for (const label of ['Group', 'Host tag', 'Host', 'Item']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });
});

test.describe('Query editor with fixture data', () => {
  test.describe.configure({ mode: 'serial' });

  test('a problems query returns the seeded problems', async ({ page }) => {
    const problemResponse = page.waitForResponse(
      async (res) => {
        const req = res.request();
        if (!isZabbixApi(req.url()) || !(req.postData() || '').includes('"problem.get"')) {
          return false;
        }
        return (await res.text()).includes('E2E problem');
      },
      { timeout: 20000 }
    );

    await page.goto(exploreUrl(problemsQuery));

    const res = await problemResponse;
    expect(res.status()).toBe(200);
  });

  test('a metrics query with hostTags only returns series for matching hosts', async ({ page }) => {
    const metricsQuery = {
      queryType: '0',
      group: { filter: 'E2E Host Tags' },
      host: { filter: '/.*/' },
      item: { filter: 'E2E host tag item' },
      hostTags: [{ tag: 'environment', value: 'production', operator: '0' }],
      evaltype: '0',
    };

    const dsQueryResponse = page.waitForResponse(
      async (res) => {
        const req = res.request();
        return req.url().includes('/api/ds/query') && (req.postData() || '').includes('E2E host tag item');
      },
      { timeout: 20000 }
    );

    await page.goto(exploreUrl(metricsQuery));

    const res = await dsQueryResponse;
    expect(res.status()).toBe(200);
    const body = await res.json();
    const frames = body.results?.A?.frames || [];
    expect(frames.length).toBeGreaterThan(0);

    const resultStr = JSON.stringify(body.results?.A);
    expect(resultStr).toContain('e2e-tagged-host');
    expect(resultStr).not.toContain('e2e-untagged-host');
  });
});
