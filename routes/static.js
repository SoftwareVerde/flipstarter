// Enable support for Express apps.
const express = require("express");
const router = express.Router();

// Package for serving static files
const nodeStatic = require("node-static");
const fileServer = new nodeStatic.Server("./static/");

const static = async function (req, res) {
  // Notify the server admin that a campaign has been requested.
  req.app.debug.server("Static file requested from " + req.ip);

  req
    .addListener("end", function () {
      fileServer.serve(req, res);
    })
    .resume();

  // Notify the server admin that a campaign has been requested.
  req.app.debug.server("Static file delivered to " + req.ip);
};

// Call static when this route is requested.
router.get("/", static);

module.exports = static;
