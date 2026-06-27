# Plugin development

## Building plugin

```sh
# install frontend deps
yarn install
# build frontend
yarn build
#build backend
mage -v
```

## Rebuild backend on changes

```sh
mage watch
```

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

If you are creating a PR, ensure to run `yarn changeset` from your branch. Provide the details accordingly. It will create `*.md` file inside `./.changeset` folder. Later during the release, based on these changesets, package version will be bumped and changelog will be generated.

## Releasing & Bumping version

To create a new release, execute `yarn changeset version`. This will update the Changelog and bump the version in `package.json` file. Commit those changes. Run the `Plugins - CD` GitHub Action to publish the new release.
