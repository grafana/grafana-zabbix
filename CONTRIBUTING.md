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
ZABBIX_VERSION=7.0 docker compose up -d --wait
```

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
backend with the seeded SQL fixtures. CI runs them via the shared Plugins-CI workflow
(`.github/workflows/push.yml`), which brings up `docker-compose.yml` and runs the
suite against it. Coverage across Zabbix versions is provided by the Go
`integration` workflow. See [`tests/e2e/README.md`](./tests/e2e/README.md) for details.

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

## Release

Releases are automated with [release-please](https://github.com/googleapis/release-please). The version number and the changelog both come from commit messages, so there is nothing to edit by hand.

### What you do

Title your pull request as a [Conventional Commit](https://www.conventionalcommits.org/). The `PR Title` check enforces this, and because the repository squash-merges, the PR title becomes the commit subject that release-please reads.

| Prefix                                                             | Effect on the next release               |
| ------------------------------------------------------------------ | ---------------------------------------- |
| `fix:`                                                             | patch version                            |
| `feat:`                                                            | minor version                            |
| `feat!:`, or a `BREAKING CHANGE:` footer                           | major version                            |
| `chore:`                                                           | no release, hidden from the changelog    |
| `docs:`, `test:`, `build:`, `ci:`, `refactor:`, `perf:`, `revert:` | no version bump, listed in the changelog |

### What happens next

1. release-please opens a `chore(main): release X.Y.Z` pull request and keeps it up to date as more commits land.
2. Merging that pull request creates the tag and the GitHub release, and publishes the plugin to the prod catalog.

### Do not

Do not edit the version in `package.json`, and do not write `CHANGELOG.md` entries by hand. release-please owns both files, and a manual edit puts `package.json` out of step with `.release-please-manifest.json`, which makes the next release pick a wrong version.

To release a specific version, add a `Release-As: X.Y.Z` footer to a commit rather than editing the version.
