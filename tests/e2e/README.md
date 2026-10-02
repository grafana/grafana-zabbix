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

## Adding or editing fixtures

Add a new `tests/fixtures/*.sql` file rather than editing `seed.sql`, so unrelated
features don't collide on the same rows. Follow the existing files
(`description-macros.sql`, `multiple-problem-events.sql`) as templates:

- Pick a fresh, fixed id block (the convention is `9_000_0xx`, one block per
  fixture — `9000001` for `seed.sql`, `9000101` for `description-macros.sql`,
  `9000201` for `multiple-problem-events.sql`) so fixtures can't collide on ids
  regardless of load order.
- Wrap inserts in `ON CONFLICT DO NOTHING` keyed on those fixed ids, so re-running
  `docker compose up` against an existing DB volume doesn't fail or duplicate rows.
- Problem/event clocks are commonly computed as `EXTRACT(EPOCH FROM now())::int - N`
  so "how long ago" stays meaningful regardless of when the fixture runs. Watch out:
  since that value changes on every run, rows whose primary key doesn't include the
  clock (e.g. `history_uint`) will keep accumulating extra rows across repeated
  `docker compose up` cycles on a long-lived DB volume rather than being
  deduplicated — harmless for `history.get` lookups (the extra rows land after the
  ones the seeded problems actually reference) but worth knowing if you're
  inspecting the DB directly. A `docker compose down -v` gives you a clean volume.
- A new fixture that provisions its own dashboard needs an entry under
  [`../../provisioning/dashboards/`](../../provisioning/dashboards/) (see `## Layout`
  above) for `readProvisionedDashboard` to find it.

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

### Browsing the Zabbix UI directly

`zabbix-web` only exposes port 8080 inside the Compose network — that's how Grafana's
datasource reaches it at `http://zabbix-web:8080`, but there's no `localhost:<port>`
for it by default. To log into Zabbix itself (e.g. to inspect or hand-edit the
seeded triggers, or to send test values with `zabbix_sender`), publish the port with
a Compose override rather than editing `docker-compose.yml`:

```yaml
# docker-compose.override.yml, at the repo root — gitignored, picked up
# automatically by plain `docker compose` commands, no -f flag needed.
services:
  zabbix-web:
    ports:
      - '8080:8080/tcp'
```

```sh
docker compose up -d --wait
```

Then open <http://localhost:8080> and log in as `Admin` / `zabbix` (see
[`../../provisioning/datasources/datasources.yml`](../../provisioning/datasources/datasources.yml)).

If `localhost:3000` is already taken by another project's Grafana container, add a
`grafana.ports` override in the same file — but Compose *merges* `ports` lists across
files by default rather than replacing them, so plain `ports:` would add a second
mapping and still fail to bind the already-taken `3000`. Use the `!override` YAML
merge tag to actually replace it:

```yaml
services:
  grafana:
    ports: !override
      - '3001:3000/tcp'
```

To send trapper values against a seeded item (e.g. to generate real multi-event
problems for `multiple-problem-events.sql`'s trigger):

```sh
docker compose exec zabbix-server zabbix_sender -z 127.0.0.1 -p 10051 \
  -s "e2e-multi-host" -k "e2e.multi.item" -o 9
```

Note that fixture triggers are usually seeded with a narrow expression (e.g.
`last(...)=1`) just to put the row directly into `PROBLEM` state at load time — sending
arbitrary values live won't open a new problem unless the value happens to match, and
may instead *resolve* the seeded one. To drive a trigger live, change its expression
in the Zabbix UI first (e.g. to `last(...)>0`).

## CI

E2E tests run in CI via the shared Plugins-CI workflow ([`.github/workflows/push.yaml`](../../.github/workflows/push.yaml)),
which brings up `docker-compose.yml` and runs `tests/e2e` against it. Coverage across
multiple Zabbix versions is provided by the per-version `devenv/` stacks and the
`compatibility-*` Go integration workflows.

## Fixtures must not contain real secrets

Fixture and provisioning files use only synthetic credentials (the Zabbix dev
password `zabbix`). They're excluded from secret scanning in `.trufflehog.yml`.
