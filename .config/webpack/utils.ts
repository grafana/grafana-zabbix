import fs from 'fs';
import path from 'path';
import util from 'util';
import glob from 'glob';
import { SOURCE_DIR } from './constants';

const globAsync = util.promisify(glob);

export function getPackageJson() {
  return require(path.resolve(process.cwd(), 'package.json'));
}

export function getPluginId() {
  const { id } = require(path.resolve(process.cwd(), `${SOURCE_DIR}/plugin.json`));

  return id;
}

export function hasReadme() {
  return fs.existsSync(path.resolve(process.cwd(), SOURCE_DIR, 'README.md'));
}

export async function getEntries(): Promise<Record<string, string>> {
  const parent = '..';
  const pluginsJson = await globAsync('**/src/**/plugin.json');

  const plugins = await Promise.all(
    pluginsJson.map((pluginJson) => {
      const folder = path.dirname(pluginJson);
      return globAsync(`${folder}/module.{ts,tsx,js}`);
    })
  );

  const entries = plugins.reduce((result, modules) => {
    return modules.reduce((result, module) => {
      const pluginPath = path.resolve(path.dirname(module), parent);
      const pluginName = path.basename(pluginPath);
      const entryName = plugins.length > 1 ? `${pluginName}/module` : 'module';

      result[entryName] = path.join(parent, module);
      return result;
    }, result);
  }, {});
  return entries;
}
