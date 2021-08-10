const baseWebpackConfig = require('./webpack.base.conf');

const conf = baseWebpackConfig;
conf.mode = 'production';
conf.devtool = 'source-map';

module.exports = baseWebpackConfig;
