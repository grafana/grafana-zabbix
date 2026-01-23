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

This mode allows you to run and debug the plugin independently without Grafana:

1. Use the **"Standalone debug mode"** configuration in VS Code (already configured in `.vscode/launch.json`)
2. Set breakpoints in your Go code
3. Press F5 or run the debugger from VS Code
4. The plugin will start in standalone mode with the `-standalone` flag

### Debugging with Docker (Recommended for Grafana Integration)

For debugging the backend plugin while it's running inside Grafana in Docker:

1. **Start Grafana with Docker:**
   The Docker setup automatically starts [delve](https://github.com/go-delve/delve) debugger in headless mode and attaches it to the running plugin process. The debugger listens on port `2345`.

2. **Attach VS Code debugger:**
   - Use the **"Attach to plugin backend in docker"** configuration in VS Code (already configured in `.vscode/launch.json`)
   - Set breakpoints in your Go code
   - Press F5 or run the debugger from VS Code
   - The debugger will connect to delve running in the Docker container

**Note:** The Docker configuration includes path substitution to map your local workspace to the container's path (`/root/alexanderzobnin-zabbix-app`), so breakpoints and source code navigation work correctly.

### VS Code Debug Configurations

The project includes pre-configured VS Code debug configurations in `.vscode/launch.json`:

- **Standalone debug mode**: Launches the plugin directly for standalone testing
- **Attach to plugin backend in docker**: Attaches to delve running in the Docker container (port 2345)

You can select either configuration from the VS Code debug panel and start debugging.

## Submitting PR

If you are creating a PR, ensure to run `yarn changeset` from your branch. Provide the details accordingly. It will create `*.md` file inside `./.changeset` folder. Later during the release, based on these changesets, package version will be bumped and changelog will be generated.

## Releasing & Bumping version

To create a new release, execute `yarn changeset version`. This will update the Changelog and bump the version in `package.json` file. Commit those changes. Run the `Plugins - CD` GitHub Action to publish the new release.
