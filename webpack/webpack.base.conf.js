const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const ExtractTextPluginLight = new ExtractTextPlugin('./css/grafana-zabbix.light.css');
const ExtractTextPluginDark = new ExtractTextPlugin('./css/grafana-zabbix.dark.css');

function resolve(dir) {
  return path.join(__dirname, '..', dir);
}

module.exports = {
  target: 'node',
  context: resolve('src'),
  entry: {
    'module': './module.js',
    'app_config_ctrl/config': './app_config_ctrl/config.js',
    'datasource-zabbix/module': './datasource-zabbix/module.ts',
    'panel-triggers/module': './panel-triggers/module.js',
  },
  output: {
    filename: "[name].js",
    path: resolve('dist'),
    libraryTarget: "amd"
  },
  externals: [
    // remove the line below if you don't want to use builtin versions
    'jquery', 'lodash', 'moment', 'angular', 'emotion',
    'react', 'react-dom', '@grafana/ui', '@grafana/data', '@grafana/runtime',
    function (context, request, callback) {
      var prefix = 'grafana/';
      if (request.indexOf(prefix) === 0) {
        return callback(null, request.substr(prefix.length));
      }
      callback();
    }
  ],
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new CopyWebpackPlugin([
      { from: '**/plugin.json' },
      { from: '**/*.html' },
      { from: '**/*.md' },
      { from: 'dashboards/*' },
      { from: '../README.md' },
      { from: '**/img/*' },
    ]),
    new CleanWebpackPlugin(['dist'], {
      root: resolve('.')
    }),
    ExtractTextPluginLight,
    ExtractTextPluginDark,
  ],
  resolve: {
    extensions: ['.js', '.es6', '.ts', '.tsx', '.html', '.scss']
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(external)/,
        use: {
          loader: 'babel-loader',
          query: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules|external/,
        loaders: [
          "ts-loader"
        ],
      },
      {
        test: /\.html$/,
        use: {
          loader: 'html-loader'
        }
      },
      {
        test: /\.light\.scss$/,
        use: ExtractTextPluginLight.extract({
          fallback: 'style-loader',
          use: ['css-loader', 'sass-loader']
        })
      },
      {
        test: /\.dark\.scss$/,
        use: ExtractTextPluginDark.extract({
          fallback: 'style-loader',
          use: ['css-loader', 'sass-loader']
        })
      },
    ]
  }
};
