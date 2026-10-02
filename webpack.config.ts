import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import grafanaConfig from './.config/webpack/webpack.config';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import RemoveEmptyScriptsPlugin from 'webpack-remove-empty-scripts';

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
      new RemoveEmptyScriptsPlugin({}),
      new MiniCssExtractPlugin({
        filename: 'styles/[name].css',
      }),
      // The managed .config/bundler/copyFiles.ts only copies the logo declared in
      // the root src/plugin.json (the app). It doesn't know about the nested
      // datasource/panel-triggers plugin.json files, so their own logos
      // (img/icn-zabbix-datasource.svg, img/icn-zabbix-problems-panel.svg) never
      // reached dist, leaving broken logo icons in Grafana's UI.
      new CopyWebpackPlugin({
        patterns: [
          { from: 'datasource/img', to: 'datasource/img' },
          { from: 'panel-triggers/img', to: 'panel-triggers/img' },
        ],
      }),
    ],
  });
};

export default config;
