import fs from 'fs';
import path from 'path';
import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import grafanaConfig from './.config/webpack/webpack.config';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import RemoveEmptyScriptsPlugin from 'webpack-remove-empty-scripts';

// The scaffolded config only copies the logos declared in the root src/plugin.json
// (the app plugin). The nested data source and panel plugins have their own
// plugin.json files, which are copied to dist, but the logo images they point to
// were not, so Grafana showed a missing icon for them. Copy those logos too.
// Logo paths in a nested plugin.json are relative to that plugin's directory.
const nestedPluginDirs = ['datasource', 'panel-triggers'];

const nestedLogoPatterns = nestedPluginDirs.flatMap((dir) => {
  const pluginJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src', dir, 'plugin.json'), 'utf8'));
  const logos: string[] = [pluginJson.info?.logos?.small, pluginJson.info?.logos?.large].filter(Boolean);
  return Array.from(new Set(logos)).map((logo) => ({ from: `${dir}/${logo}`, to: `${dir}/${logo}` }));
});

const config = async (env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  return merge(baseConfig, {
    // Add custom config here...
    entry: {
      module: './module.ts',
      'datasource/module': './datasource/module.ts',
      'panel-triggers/module': './panel-triggers/module.tsx',
      dark: './styles/dark.scss',
      light: './styles/light.scss',
    },

    module: {
      rules: [
        {
          test: /(dark|light)\.scss$/,
          exclude: /node_modules/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                url: false,
                sourceMap: false,
              },
            },
            {
              loader: require.resolve('postcss-loader'),
              options: {
                postcssOptions: {
                  plugins: () => [
                    require('postcss-flexbugs-fixes'),
                    require('postcss-preset-env')({
                      autoprefixer: { flexbox: 'no-2009', grid: true },
                    }),
                  ],
                },
              },
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: false,
              },
            },
          ],
        },
      ],
    },

    plugins: [
      new CopyWebpackPlugin({ patterns: nestedLogoPatterns }),
      new RemoveEmptyScriptsPlugin({}),
      new MiniCssExtractPlugin({
        filename: 'styles/[name].css',
      }),
    ],
  });
};

export default config;
