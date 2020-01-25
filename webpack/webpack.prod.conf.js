const baseWebpackConfig = require('./webpack.base.conf');

var conf = baseWebpackConfig;
conf.mode = 'production';
conf.devtool = 'source-map';

module.exports = baseWebpackConfig;
