const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    popup: './src/popup.ts',
    content: './src/content.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/popup.html', to: 'popup.html' },
        { from: 'src/popup.css', to: 'popup.css' },
        { from: 'icons', to: 'icons' },
        { from: 'assets', to: 'assets' },
        { from: 'src/parsers', to: 'parsers' },
      ],
    }),
  ],
};