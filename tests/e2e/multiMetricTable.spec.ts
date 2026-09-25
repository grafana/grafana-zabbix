import { test, expect, PluginFixture, PlaywrightArgs } from '@grafana/plugin-e2e';

/**
 * End-to-end tests for the Multi-metric Table query type against the real
 * provisioned Zabbix backend.
 *
 * Data comes from tests/fixtures/multimetric-table.sql (host group "E2E Multi-metric"):
 *   - e2e-mm-router-a: LLD-style interface items for eth0(WAN), eth1(LAN), eth2(DMZ);
 *     eth2 is down (status 0, 0 bps: a genuine zero). Also host-level CPU/Memory/
 *     Uptime/OS items and a "Process zabbix_server: CPU utilization" substring trap.
 *   - e2e-mm-router-b: eth0(WAN), eth1(LAN); the eth1 Speed item never received a value.
 *   - e2e-mm-vm-c: host-level items only; its Swap utilization item never received a value.
 *
 * Each panel of provisioning/dashboards/multimetric-table.json covers one scenario. The
 * tests open a panel in view mode, capture the backend response (the frames carry the
 * exact values, including nulls) and check what the table renders.
 */

const DASHBOARD_FILE = 'multimetric-table.json';
const ROUTER_A = 'e2e-mm-router-a';
const ROUTER_B = 'e2e-mm-router-b';
const VM_C = 'e2e-mm-vm-c';

type Field = { name: string; type: string; labels?: Record<string, string> };
type Frame = { schema: { refId?: string; fields: Field[] }; data: { values: unknown[][] } };

type Ctx = Pick<PluginFixture & PlaywrightArgs, 'page' | 'gotoDashboardPage' | 'readProvisionedDashboard'>;

const isDsQuery = (url: string) => url.includes('/api/ds/query');

/** Opens one panel in view mode and returns the frames the backend answered with. */
async function openPanel({ page, gotoDashboardPage, readProvisionedDashboard }: Ctx, panelId: number) {
  const dashboard = await readProvisionedDashboard({ fileName: DASHBOARD_FILE });

  const queryResponse = page.waitForResponse((res) => isDsQuery(res.url()) && res.request().method() === 'POST', {
    timeout: 30000,
  });

  const dashboardPage = await gotoDashboardPage({
    ...dashboard,
    queryParams: new URLSearchParams({ viewPanel: `panel-${panelId}` }),
  });

  const res = await queryResponse;
  expect(res.status()).toBe(200);
  const body = await res.json();
  const frames: Frame[] = body.results?.A?.frames ?? [];

  await dashboardPage.waitForPanelsQueriesToComplete({ timeout: 30000 });
  return { dashboardPage, frames };
}

const hasTimeField = (f: Frame) => f.schema.fields.some((field) => field.type === 'time');
const fieldNames = (f: Frame) => f.schema.fields.map((field) => field.name);

/** The scalar table frame (no time field); sparkline frames are time series. */
function tableFrame(frames: Frame[]): Frame {
  const table = frames.filter((f) => !hasTimeField(f));
  expect(table).toHaveLength(1);
  return table[0];
}

function rows(frame: Frame): Record<string, unknown>[] {
  const names = fieldNames(frame);
  const count = frame.data.values[0]?.length ?? 0;
  return Array.from({ length: count }, (_, i) =>
    Object.fromEntries(names.map((name, col) => [name, frame.data.values[col][i]]))
  );
}

function row(frame: Frame, match: Record<string, unknown>): Record<string, unknown> {
  const found = rows(frame).filter((r) => Object.entries(match).every(([k, v]) => r[k] === v));
  expect(found, `row matching ${JSON.stringify(match)}`).toHaveLength(1);
  return found[0];
}

const seriesFor = (frames: Frame[], refId: string) => frames.filter((f) => hasTimeField(f) && f.schema.refId === refId);

test.describe('Multi-metric Table: rows from Item pattern (LLD entities)', () => {
  test('extracted columns, multiple hosts and last values', async ({
    page,
    gotoDashboardPage,
    readProvisionedDashboard,
  }) => {
    const { dashboardPage, frames } = await openPanel({ page, gotoDashboardPage, readProvisionedDashboard }, 1);
    const table = tableFrame(frames);

    // Two capture groups become columns; Host is added automatically for several hosts.
    expect(fieldNames(table)).toEqual([
      'Host',
      'Interface',
      'Alias',
      'Bits in',
      'Bits out',
      'Status',
      'Speed',
      'Description',
    ]);
    expect(rows(table)).toHaveLength(5);

    // Rows are de-duplicated per host + extracted values; values join on the same key.
    expect(row(table, { Host: ROUTER_A, Interface: 'eth0' })).toMatchObject({
      Alias: 'WAN',
      'Bits in': '6000000',
      'Bits out': '2400000',
      Status: '1',
      Speed: '1000000000',
      Description: 'Uplink to ISP',
    });

    // A genuine zero (interface down) is kept as 0.
    expect(row(table, { Host: ROUTER_A, Interface: 'eth2' })).toMatchObject({
      Alias: 'DMZ',
      'Bits in': '0',
      'Bits out': '0',
      Status: '0',
    });

    // An item that never received a value is null, not the "0" Zabbix reports as lastvalue.
    expect(row(table, { Host: ROUTER_B, Interface: 'eth1' })).toMatchObject({ Speed: null, 'Bits in': '1080000' });

    const panel = dashboardPage.getPanelByTitle('1. LLD rows (Item pattern): extracted columns, multi-host, last');
    await expect(panel.fieldNames).toContainText(['Host', 'Interface', 'Alias', 'Bits in', 'Bits out', 'Status']);
    await expect(panel.data).toContainText([ROUTER_A, 'eth0', 'WAN', '6000000']);
  });

  test('history aggregations for a single host with Group and Host columns', async ({
    page,
    gotoDashboardPage,
    readProvisionedDashboard,
  }) => {
    const { frames } = await openPanel({ page, gotoDashboardPage, readProvisionedDashboard }, 2);
    const table = tableFrame(frames);

    expect(fieldNames(table)).toEqual([
      'Group',
      'Host',
      'Interface',
      'Bits in avg',
      'Bits in min',
      'Bits in max',
      'Bits out p95',
      'Bits out sum',
      'Status median',
    ]);
    expect(rows(table)).toHaveLength(3);

    // Bits received on eth0 is a sawtooth 5000000..7950000 (step 50000 over 60 samples).
    const eth0 = row(table, { Interface: 'eth0' });
    expect(eth0).toMatchObject({
      Group: 'E2E Multi-metric',
      Host: ROUTER_A,
      'Bits in min': '5000000.00',
      'Bits in max': '7950000.00',
    });
    const avg = Number(eth0['Bits in avg']);
    expect(avg).toBeGreaterThan(5000000);
    expect(avg).toBeLessThan(7950000);
    expect(eth0['Status median']).toBe('1.00');

    // The down interface aggregates to zero everywhere.
    expect(row(table, { Interface: 'eth2' })).toMatchObject({
      'Bits in avg': '0.00',
      'Bits in max': '0.00',
      'Bits out sum': '0.00',
      'Status median': '0.00',
    });
  });

  test('search by item key with key-based extraction', async ({
    page,
    gotoDashboardPage,
    readProvisionedDashboard,
  }) => {
    const { frames } = await openPanel({ page, gotoDashboardPage, readProvisionedDashboard }, 3);
    const table = tableFrame(frames);

    expect(fieldNames(table)).toEqual(['Host', 'Interface', 'Bits in', 'Bits out', 'Status']);
    expect(rows(table)).toHaveLength(5);
    // Interface comes from the key (net.if.in[eth0]), values are matched on keys too.
    expect(row(table, { Host: ROUTER_B, Interface: 'eth0' })).toMatchObject({
      'Bits in': '4800000',
      'Bits out': '1800000',
      Status: '1',
    });
  });

  test('a pattern matching no items yields an empty panel', async ({
    page,
    gotoDashboardPage,
    readProvisionedDashboard,
  }) => {
    const { dashboardPage, frames } = await openPanel({ page, gotoDashboardPage, readProvisionedDashboard }, 10);
    expect(frames).toHaveLength(0);

    const panel = dashboardPage.getPanelByTitle('10. Empty result: pattern matching no items');
    await expect(panel.locator.getByText('No data')).toBeVisible();
  });
});

test.describe('Multi-metric Table: rows from Hosts', () => {
  test('exact-match patterns, text columns and never-collected items', async ({
    page,
    gotoDashboardPage,
    readProvisionedDashboard,
  }) => {
    const { dashboardPage, frames } = await openPanel({ page, gotoDashboardPage, readProvisionedDashboard }, 4);
    const table = tableFrame(frames);

    expect(fieldNames(table)).toEqual(['Group', 'Host', 'CPU', 'Memory', 'Uptime', 'Swap', 'OS']);
    // One row per host, sorted by host name.
    expect(rows(table).map((r) => r.Host)).toEqual([ROUTER_A, ROUTER_B, VM_C]);

    // "CPU utilization" is an exact match: the "Process zabbix_server: CPU utilization"
    // item (constant 2.5) on router-a must not be picked up.
    const routerA = row(table, { Host: ROUTER_A });
    expect(routerA).toMatchObject({ Group: 'E2E Multi-metric', CPU: '30', Memory: '40', OS: 'Linux 6.8.0 router-a' });
    expect(routerA.CPU).not.toBe('2.5');

    // vm-c has a Swap item that never received a value (Zabbix reports lastvalue "0"),
    // the routers have no such item: all null.
    expect(rows(table).map((r) => r.Swap)).toEqual([null, null, null]);
    expect(row(table, { Host: VM_C })).toMatchObject({ CPU: '60', Memory: '75', OS: 'Ubuntu 24.04 LTS' });

    const panel = dashboardPage.getPanelByTitle('4. Host rows: exact-match patterns, text and never-collected columns');
    await expect(panel.fieldNames).toContainText(['Group', 'Host', 'CPU', 'Memory', 'Uptime', 'Swap', 'OS']);
    await expect(panel.data).toContainText([ROUTER_A, ROUTER_B, VM_C]);
  });

  test('history aggregations per host', async ({ page, gotoDashboardPage, readProvisionedDashboard }) => {
    const { frames } = await openPanel({ page, gotoDashboardPage, readProvisionedDashboard }, 5);
    const table = tableFrame(frames);

    expect(fieldNames(table)).toEqual(['Host', 'CPU avg', 'CPU max', 'Memory avg', 'Memory min']);
    expect(rows(table)).toHaveLength(3);
    // router-a CPU is a sawtooth 10..49, Memory 40..49.5; vm-c CPU 60..69.
    expect(row(table, { Host: ROUTER_A })).toMatchObject({ 'CPU max': '49.00', 'Memory min': '40.00' });
    expect(row(table, { Host: VM_C })).toMatchObject({ 'CPU max': '69.00', 'Memory min': '75.00' });
    const avg = Number(row(table, { Host: ROUTER_A })['CPU avg']);
    expect(avg).toBeGreaterThan(10);
    expect(avg).toBeLessThan(49);
  });

  test('a single metric column', async ({ page, gotoDashboardPage, readProvisionedDashboard }) => {
    const { frames } = await openPanel({ page, gotoDashboardPage, readProvisionedDashboard }, 6);
    const table = tableFrame(frames);

    expect(fieldNames(table)).toEqual(['Host', 'CPU']);
    expect(rows(table).map((r) => [r.Host, r.CPU])).toEqual([
      [ROUTER_A, '30'],
      [ROUTER_B, '30'],
      [VM_C, '60'],
    ]);
  });
});

test.describe('Multi-metric Table: sparkline columns', () => {
  test('Item pattern, single host: one time-series frame set per metric, joined on Interface', async ({
    page,
    gotoDashboardPage,
    readProvisionedDashboard,
  }) => {
    const { dashboardPage, frames } = await openPanel({ page, gotoDashboardPage, readProvisionedDashboard }, 7);

    // Sparkline columns are not scalar columns; the table frame keeps the dimensions + Status.
    expect(fieldNames(tableFrame(frames))).toEqual(['Interface', 'Status']);

    // Each sparkline metric is its own RefID so "Time series to table" yields one Trend column per metric.
    for (const refId of ['Bits in', 'Bits out']) {
      const series = seriesFor(frames, refId);
      expect(series, refId).toHaveLength(3);
      for (const s of series) {
        expect(fieldNames(s)).toEqual(['Time', 'Value']);
        expect(Object.keys(s.schema.fields[1].labels ?? {}).sort()).toEqual(['Host', 'Interface']);
        // Aligned series: strictly increasing time axis.
        const time = s.data.values[0] as number[];
        expect(time.length).toBeGreaterThan(10);
        expect(time.every((t, i) => i === 0 || t > time[i - 1])).toBe(true);
      }
    }
    expect(seriesFor(frames, 'A')).toHaveLength(0);

    const panel = dashboardPage.getPanelByTitle('7. LLD sparklines: single host, joined on Interface');
    await expect(panel.fieldNames).toContainText(['Interface', 'Status', 'Trend #Bits in', 'Trend #Bits out']);
    await expect(panel.data).toContainText(['eth0', '1']);
    await expect(panel.getErrorIcon()).toHaveCount(0);
  });

  test('Item pattern, multiple hosts: series labeled by Host, Interface and Alias for Merge', async ({
    page,
    gotoDashboardPage,
    readProvisionedDashboard,
  }) => {
    const { dashboardPage, frames } = await openPanel({ page, gotoDashboardPage, readProvisionedDashboard }, 8);

    const table = tableFrame(frames);
    expect(fieldNames(table)).toEqual(['Host', 'Interface', 'Alias']);
    expect(rows(table)).toHaveLength(5);

    for (const refId of ['Bits in', 'Bits out']) {
      const series = seriesFor(frames, refId);
      expect(series, refId).toHaveLength(5);
      expect(Object.keys(series[0].schema.fields[1].labels ?? {}).sort()).toEqual(['Alias', 'Host', 'Interface']);
    }

    const panel = dashboardPage.getPanelByTitle('8. LLD sparklines: multi-host, merged on Host + Interface + Alias');
    await expect(panel.fieldNames).toContainText(['Host', 'Interface', 'Alias', 'Trend #Bits in', 'Trend #Bits out']);
    await expect(panel.data).toContainText([ROUTER_B]);
    await expect(panel.getErrorIcon()).toHaveCount(0);
  });

  test('Hosts: series labeled by Host only, joined on Host', async ({
    page,
    gotoDashboardPage,
    readProvisionedDashboard,
  }) => {
    const { dashboardPage, frames } = await openPanel({ page, gotoDashboardPage, readProvisionedDashboard }, 9);

    expect(fieldNames(tableFrame(frames))).toEqual(['Host', 'Uptime']);
    for (const refId of ['CPU', 'Memory']) {
      const series = seriesFor(frames, refId);
      expect(series, refId).toHaveLength(3);
      expect(series.map((s) => s.schema.fields[1].labels)).toEqual([
        { Host: ROUTER_A },
        { Host: ROUTER_B },
        { Host: VM_C },
      ]);
    }

    const panel = dashboardPage.getPanelByTitle('9. Host sparklines: joined on Host');
    await expect(panel.fieldNames).toContainText(['Host', 'Uptime', 'Trend #CPU', 'Trend #Memory']);
    await expect(panel.data).toContainText([ROUTER_A, '2592000']);
    await expect(panel.getErrorIcon()).toHaveCount(0);
  });
});

test.describe('Multi-metric Table: query editor', () => {
  const DS_UID = 'zabbix-e2e';

  // Explore URL with a pre-set query, so the tests don't depend on driving the comboboxes.
  function exploreUrl(tableConfig: Record<string, unknown>) {
    const query = {
      refId: 'A',
      datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: DS_UID },
      queryType: '7',
      schema: 13,
      group: { filter: 'E2E Multi-metric' },
      host: { filter: '/.*/' },
      application: { filter: '' },
      itemTag: { filter: '' },
      item: { filter: '' },
      hostTags: [],
      evaltype: '0',
      functions: [],
      options: {
        showDisabledItems: false,
        disableDataAlignment: false,
        useZabbixValueMapping: false,
        useTrends: 'default',
      },
      tableConfig,
    };
    const panes = { a: { datasource: DS_UID, queries: [query], range: { from: 'now-6h', to: 'now' } } };
    return `/explore?schemaVersion=1&orgId=1&panes=${encodeURIComponent(JSON.stringify(panes))}`;
  }

  const numericMetric = {
    columnName: 'CPU',
    searchType: 'itemName',
    pattern: 'CPU utilization',
    aggregation: 'last',
    valueType: 'num',
  };
  const textMetric = {
    columnName: 'OS',
    searchType: 'itemName',
    pattern: 'OS name',
    aggregation: 'last',
    valueType: 'text',
  };

  test('Hosts mode hides the entity pattern fields and the Show Host column checkbox', async ({ page }) => {
    await page.goto(
      exploreUrl({
        rowSource: 'host',
        entityPattern: { searchType: 'itemName', pattern: '' },
        metrics: [numericMetric],
      })
    );

    await expect(page.getByText('Table Rows', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Hosts' })).toBeChecked();
    await expect(page.getByText('One row per host.')).toBeVisible();
    await expect(page.getByText('Extract pattern', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Show Host column' })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Show Group column' })).toBeVisible();
  });

  test('Item pattern mode shows the entity pattern fields', async ({ page }) => {
    await page.goto(
      exploreUrl({
        rowSource: 'entityPattern',
        entityPattern: { searchType: 'itemName', pattern: '/^Interface .*/', extractPattern: '' },
        metrics: [numericMetric],
      })
    );

    await expect(page.getByRole('radio', { name: 'Item pattern' })).toBeChecked();
    await expect(page.getByText('Extract pattern', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Show Host column' })).toBeVisible();
  });

  test('text columns lock the aggregation to Last and have no sparkline toggle', async ({ page }) => {
    await page.goto(
      exploreUrl({
        rowSource: 'host',
        entityPattern: { searchType: 'itemName', pattern: '' },
        metrics: [textMetric, numericMetric],
      })
    );

    await expect(page.getByRole('textbox', { name: 'Column' }).first()).toHaveValue('OS');

    // First metric is text: aggregation locked to Last and disabled, no Sparkline checkbox.
    // A disabled Select is not exposed as an accessible combobox, so the selects are
    // addressed by the stable ids the editor assigns per metric row.
    await expect(page.getByRole('radio', { name: 'Text' }).first()).toBeChecked();
    await expect(page.locator('#multimetric-aggregation-0')).toBeDisabled();

    // Second metric is numeric: aggregation enabled, Sparkline available. Exactly one
    // Sparkline checkbox on the page means the text column has none.
    await expect(page.locator('#multimetric-aggregation-1')).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: 'Sparkline' })).toHaveCount(1);
    await expect(page.getByRole('checkbox', { name: 'Sparkline' })).not.toBeChecked();
  });
});
