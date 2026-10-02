import { test, expect } from '@grafana/plugin-e2e';

/**
 * Regression test for a broken-logo bug (support escalation #24407): the
 * managed webpack config (.config/bundler/copyFiles.ts) only copies the logo
 * declared in the root src/plugin.json (the app), so the nested datasource
 * and panel-triggers plugin.json files' own logos never reached dist, and
 * Grafana served a 404 for them wherever it rendered the plugin icon.
 *
 * Reads each plugin's logo path from its own /api/plugins/:id/settings
 * response (what Grafana itself resolves) rather than hardcoding the path,
 * so the test still holds if a logo file is ever renamed.
 */

const PLUGIN_IDS = ['alexanderzobnin-zabbix-app', 'alexanderzobnin-zabbix-datasource', 'alexanderzobnin-zabbix-triggers-panel'];

for (const pluginId of PLUGIN_IDS) {
  test(`${pluginId} logo is served (not a 404)`, async ({ request }) => {
    const settings = await request.get(`/api/plugins/${pluginId}/settings`);
    expect(settings.ok()).toBe(true);
    const { info } = await settings.json();

    const logo = await request.get(`/${info.logos.small}`);
    expect(logo.status()).toBe(200);
    expect(logo.headers()['content-type']).toContain('svg');
  });
}
