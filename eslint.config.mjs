import { defineConfig } from 'eslint/config';
import baseConfig from './.config/eslint.config.mjs';
import prettier from 'eslint-plugin-prettier';

export default defineConfig([
  {
    ignores: [
      '**/*.sublime-workspace',
      '**/*.sublime-project',
      '**/.idea/',
      '**/.vscode',
      '**/*.bat',
      '**/.DS_Store',
      'docs/site/',
      'dist/test/',
      'dist/test-setup/',
      '**/vendor',
      'src/vendor',
      'src/vendor/npm',
      '**/node_modules',
      '**/coverage/',
      'tmp',
      '**/artifacts/',
      '**/work/',
      '**/test-results/',
      '**/playwright-report/',
      '**/blob-report/',
      'playwright/.cache/',
      'playwright/.auth/',
      '**/npm-debug.log',
      '**/yarn-error.log',
      '**/dist/',
      '**/ci/',
      '**/alexanderzobnin-zabbix-app.zip',
      '**/.eslintcache',
      'public/css/*.min.css',
      '**/provisioning/',
      'devenv/nginx/nginx.crt',
      'devenv/nginx/nginx.key',
      '**/.pnp.*',
      '.yarn/*',
      '!.yarn/patches',
      '!.yarn/plugins',
      '!.yarn/releases',
      '!.yarn/sdks',
      '!.yarn/versions',
    ],
  },
  ...baseConfig,
  {
    plugins: {
      prettier: prettier,
    },

    rules: {
      'react-hooks/exhaustive-deps': 'off',
      'prettier/prettier': 'error',
    },
  },
]);
