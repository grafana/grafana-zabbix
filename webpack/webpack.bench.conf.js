const path = require('path');
const baseWebpackConfig = require('./webpack.base.conf');
const CleanWebpackPlugin = require('clean-webpack-plugin');

function resolve(dir) {
  return path.join(__dirname, '..', dir);
}

var conf = baseWebpackConfig;
conf.mode = 'development';
conf.entry = {
  'datasource-zabbix/benchmarks/timeseries_bench': './datasource-zabbix/benchmarks/timeseries_bench.js',
};
conf.output = {
  filename: "[name].js",
  path: resolve('tmp/dist'),
  libraryTarget: "commonjs2"
};
conf.plugins = [
  new CleanWebpackPlugin(['tmp'], {
    root: resolve('.')
  }),
];
conf.module.rules = [
  {
    test: /\.js$/,
    exclude: /(external)/,
    use: {
      loader: 'babel-loader',
      query: {
        presets: ['babel-preset-env']
      }
    }
  },
];

module.exports = baseWebpackConfig;
