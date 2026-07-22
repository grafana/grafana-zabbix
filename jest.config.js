// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),

  // Some dependencies (e.g. @marcbachmann/cel-js, pulled in transitively by
  // @grafana/plugin-ui) ship ESM-only builds that must be transformed by Jest.
  transformIgnorePatterns: [nodeModulesToTransform([...grafanaESModules, '@marcbachmann/cel-js'])],
};
