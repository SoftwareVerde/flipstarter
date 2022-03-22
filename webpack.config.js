const webpack = require("webpack");
const path = require("path");

module.exports = {
  mode: "development",

  // Add your application's scripts below
  entry: ["./shared.js", "./source.js", "./web-wallet.js", "./src/websocket.js"],
  output: {
    path: path.join(__dirname, "./static/js/"), // eslint-disable-line
    filename: "application.js"
  },
  plugins: [new webpack.IgnorePlugin({
    resourceRegExp: /^\.\/locale$/,
    contextRegExp: /moment$/,
  })]
};
