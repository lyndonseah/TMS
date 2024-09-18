const path = require("path");
const { override, addWebpackPlugin } = require("customize-cra");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = override(
  addWebpackPlugin(
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public", "index.html"), // If want to use other .html, can edit here
      filename: "index.html" // Just a file name, not the actual file
    })
  )
);
