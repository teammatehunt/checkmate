const glob = require('glob');
const path = require('path');

// const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CleanWebpackPlugin = require('webpack-clean-obsolete-chunks');

module.exports = {
  entry: Object.assign({}, ...glob.sync('./apps/**/*.tsx').map(filename => ({ [path.parse(filename).name]: filename}))),
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    modules: [
      '/node_modules',
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname),
    ],
  },
  output: {
    path: "/build/frontend/static", // must be in Django STATICFILES_DIRS
    publicPath: "/static/", // must match Django STATIC_URL
    filename: "[name].js", // no filename hashing so Django can render in template
    chunkFilename: "[id]-[chunkhash].js", // hash chunks as these are loaded clientside
    library: "[name]Module",
    libraryTarget: "var",
  },
  devServer: {
    writeToDisk: true, // also write files to disk in dev mode for Django
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ],
      },
      {
        test: /\.svg$/,
        use: ['@svgr/webpack'],
      },
      {
        test: /\.(png|jpe?g|gif)$/,
        use: ['file-loader'],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
  ],
}
