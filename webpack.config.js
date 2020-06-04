const webpack = require("webpack");

module.exports = {
  mode: "development",

  // Add your application's scripts below
  entry: ["./source.js"],
  output: {
    filename: "./static/js/application.js",
  },
  plugins: [new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/)],
};
