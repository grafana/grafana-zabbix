import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import grafanaConfig from './.config/webpack/webpack.config';
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
    ],
  });
};

export default config;
