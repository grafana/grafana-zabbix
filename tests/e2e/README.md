# End-to-end tests

Playwright tests (using [`@grafana/plugin-e2e`](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/))
that run against a **real Zabbix backend** with deterministic fixture data.

## Layout

| Path | Purpose |
| --- | --- |
| `*.spec.ts`, `*.test.ts` | The tests. |
| `../fixtures/*.sql` | Deterministic dataset, loaded into the Zabbix DB on startup. |
| `../../provisioning/datasources/` | Provisioned Zabbix data source (`uid: zabbix-e2e`). |
| `../../provisioning/dashboards/` | Provisioned dashboards used by tests, loaded via `readProvisionedDashboard`. |

Provisioning lives at the repo root (`provisioning/`), the default `provisioningRootDir`
for `@grafana/plugin-e2e` and the path the base Docker Compose mounts into Grafana.

## How the environment is wired

The root [`docker-compose.yml`](../../docker-compose.yml) brings up PostgreSQL, the
Zabbix server/web, a one-shot `e2e-data-loader`, and Grafana. Grafana `depends_on`
the loader with `service_completed_successfully`, so tests never start against an
empty backend.

`e2e-data-loader` runs every `tests/fixtures/*.sql` file in lexicographic order via `psql`,
so new feature-specific fixtures can live alongside `seed.sql` without merge
conflicts when multiple PRs add fixtures.

`seed.sql` creates a self-contained dataset: a host with two trapper items +
triggers, two **open** problems (one recent and one deliberately backdated ~30 days),
and `history_uint` rows across the window. The backdated problem is what makes the
issue [#2427](https://github.com/grafana/grafana-zabbix/issues/2427) `history.get`
window bound observable. It targets the current Zabbix schema and is idempotent.

## Running locally

```sh
# from the repo root
make dist                       # build the plugin into ./dist
docker compose up -d --wait     # start the stack (ZABBIX_VERSION optional, default 7.0)
npm run e2e                     # run the tests against http://localhost:3000
```

Run a single spec, or try another Zabbix version:

```sh
npx playwright test tests/e2e/problemsHistoryBounded.spec.ts
ZABBIX_VERSION=8.0 docker compose up -d --wait && npm run e2e
```

The Zabbix version is fixed when the database is first initialised. To switch an
existing stack to another version, drop its volumes first with `docker compose down -v`.

## CI

The suite runs in CI against two Zabbix versions:

| Zabbix | Workflow | Grafana versions |
| --- | --- | --- |
| 7.0 (compose default) | Shared Plugins-CI workflow, [`.github/workflows/push.yaml`](../../.github/workflows/push.yaml) | Every version the shared workflow resolves from the plugin's `grafanaDependency` |
| 8.0 | [`.github/workflows/e2e-zabbix-versions.yml`](../../.github/workflows/e2e-zabbix-versions.yml) | The compose default only |

Both bring up `docker-compose.yml` and run `tests/e2e` against it. The shared workflow
has no input for passing `ZABBIX_VERSION` to the compose stack, so the 8.0 run lives in
its own workflow, which builds the plugin, starts the stack with `ZABBIX_VERSION=8.0`
and runs `npm run e2e`. To cover another Zabbix version, add it to that workflow's
`matrix.version`.

Fixtures and specs must therefore pass on both versions. The 8.0 schema differs from
7.0 (for example, trigger state lives in `trigger_rtdata` instead of `triggers`), so
check a new `tests/fixtures/*.sql` file against both before opening a PR.

The Go `integration` workflow separately covers the Zabbix API client against 6.0,
7.0, 7.4 and 8.0 using the per-version `devenv/` stacks.

## Fixtures must not contain real secrets

Fixture and provisioning files use only synthetic credentials (the Zabbix dev
password `zabbix`). They're excluded from secret scanning in `.trufflehog.yml`.
