// Enable support for Express apps.
const express = require("express");
const router = express.Router();
const app = require("../server.js");

var renderer = require("../src/renderer.js");

// Wrap the campaign request in an async function.
const create = async function (req, res) {
  // Notify the server admin that a campaign has been requested.
  req.app.debug.server(`Create page requested from ` + req.ip);

  // Render HTML
  renderer.view("create.html", res);
  res.end();

  // Notify the server admin that a campaign has been requested.
  req.app.debug.server(`Create page delivered to ` + req.ip);
};

const initCapampaign = async function (req, res) {
  req.app.debug.server(`Init campaign from ` + req.ip);

  // Actually initialize the campaign with the POST data
  // app.queries.addCampaign();

  // Render a success message
  renderer.view("initCampaign.html", res);
  res.end();

  req.app.debug.server(`Campaign created`);
};

// Call create when this route is requested.
router.get("/", create);
// Init when the form is submitted
router.post("/", initCapampaign);

module.exports = router;
