const baseWebpackConfig = require('./webpack.base.conf');
const NgAnnotatePlugin = require('ng-annotate-webpack-plugin');

var conf = baseWebpackConfig;
conf.mode = 'production';
conf.plugins.push(new NgAnnotatePlugin());

module.exports = baseWebpackConfig;
