# Plugin development

## Building plugin

```sh
# install frontend deps
npm install
# build frontend
npm run build
#build backend
mage -v
```

## Rebuild backend on changes

```sh
mage watch
```

## Running a development environment

The root `docker-compose.yml` is the canonical environment for both local development
and CI. It starts Grafana (with the plugin from `./dist`), a Zabbix server + web +
PostgreSQL, and a one-shot fixture loader that seeds a deterministic dataset, so the
data source works immediately without waiting for organic data.

```sh
# Build the plugin first (Grafana loads it from ./dist)
make dist

# Start everything (Grafana on http://localhost:3000, admin/admin)
npm run server       # == docker compose up --build

# After editing sources, rebuild and restart Grafana
npm run build && docker compose restart grafana
```

Switch the Zabbix version with `ZABBIX_VERSION` (default `7.0`):

```sh
ZABBIX_VERSION=8.0 docker compose up -d --wait
```

When switching an existing stack to another Zabbix version, run `docker compose down -v`
first; the database keeps the schema of the version that created it.

For richer, version-specific scenarios — including TLS + HTTP basic auth (6.0/7.0) —
use the per-version stacks under [`devenv/`](./devenv); those are also what the
`integration` workflow runs against.

## Testing

```sh
# Unit tests
npm test             # frontend (watch)
go test ./pkg/...    # backend

# End-to-end tests (Playwright) — needs the environment above running
npm run e2e
```

End-to-end tests live in [`tests/e2e`](./tests/e2e) and run against the real Zabbix
backend with the seeded SQL fixtures. CI runs them against two Zabbix versions: 7.0
(the default) via the shared Plugins-CI workflow (`.github/workflows/push.yaml`), and
8.0 via `.github/workflows/e2e-zabbix-versions.yml`. Both bring up `docker-compose.yml`
and run the suite against it, so fixtures and specs need to pass on both. The Go
`integration` workflow covers the Zabbix API client across more versions. See
[`tests/e2e/README.md`](./tests/e2e/README.md) for details.

## Debugging backend plugin

The plugin supports two debugging modes for the Go backend:

### Standalone Debug Mode

This mode allows you to run and debug the plugin locally:

1. Use the **"Standalone debug mode"** configuration in VS Code (already configured in `.vscode/launch.json`)
2. Set breakpoints in your Go code
3. The plugin will start in standalone mode with the `-standalone` flag
4. Run your local grafana instance

### Debugging with Docker (Recommended for Grafana Integration)

For debugging the backend plugin while it's running inside Grafana in Docker:

1. Run the docker compose file with the following command in any of the devenv folders:

```sh
DEVELOPMENT=true docker compose up --build -d
```

1. Attach VS Code debugger:
   - Use the **"Attach to plugin backend in docker"** configuration in VS Code (already configured in `.vscode/launch.json`)
   - Set breakpoints in your Go code
   - The debugger will connect to delve running in the Docker container

## Submitting PR

If you are creating a PR, ensure to run `npx changeset` from your branch. Provide the details accordingly. It will create `*.md` file inside `./.changeset` folder. Later during the release, based on these changesets, package version will be bumped and changelog will be generated.

## Releasing & Bumping version

To create a new release, execute `npx changeset version`. This will update the Changelog and bump the version in `package.json` file. Commit those changes. Run the `Plugins - CD` GitHub Action to publish the new release.
