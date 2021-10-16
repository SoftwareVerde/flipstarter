// Enable support for Express apps.
const express = require("express");
const router = express.Router();
const app = require("../server.js");

const renderer = require("../src/renderer.js");
const fs = require("fs");
const marked = require("marked");

// Wrap the campaign request in an async function.
const home = async function (req, res) {
  // Notify the server admin that a campaign has been requested.
  req.app.debug.server("Home page requested from " + req.ip);

  // Redirect to campaign creation page if no campaign was created
  if (app.freshInstall) {
    return res.redirect("/create");
  }

  let description = fs.readFileSync("./static/campaigns/1/en/abstract.md").toString();

  // Render HTML
  renderer.view("index.html", res, {
    "<!-- campaign.title -->":  req.app.queries.getCampaign.get({
      campaign_id: 1,
    }).title,
    "<!-- campaign.description -->":  marked(description).replace(/<[^>]*>?/gm, "").trim(),
  });

  res.end();
  // Notify the server admin that a campaign has been requested.
  req.app.debug.server("Home page delivered to " + req.ip);
};

// Call home when this route is requested.
router.get("/", home);

module.exports = router;
