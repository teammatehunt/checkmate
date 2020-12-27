const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
  },
  output: {
    path: path.resolve(__dirname, "build/dev/static"), // must be in Django STATICFILES_DIRS
  },
});
