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
ZABBIX_VERSION=7.0 docker compose up -d --wait && npm run e2e
```

## CI

E2E tests run in CI via the shared Plugins-CI workflow ([`.github/workflows/push.yaml`](../../.github/workflows/push.yaml)),
which brings up `docker-compose.yml` and runs `tests/e2e` against it. Coverage across
multiple Zabbix versions is provided by the per-version `devenv/` stacks and the
`compatibility-*` Go integration workflows.

## Fixtures must not contain real secrets

Fixture and provisioning files use only synthetic credentials (the Zabbix dev
password `zabbix`). They're excluded from secret scanning in `.trufflehog.yml`.
