// Enable support for Express apps.
const express = require("express");
const router = express.Router();
const app = require("../server.js");

var renderer = require("../src/renderer.js");

// Wrap the campaign request in an async function.
const create = async function (req, res) {
  // Notify the server admin that a campaign has been requested.
  req.app.debug.server(`Create page requested from ` + req.ip);

  if (!app.freshInstall) {
    return res.redirect("/");
  }

  // Render HTML
  renderer.view("create.html", res);
  res.end();

  // Notify the server admin that a campaign has been requested.
  req.app.debug.server(`Create page delivered to ` + req.ip);
};

const initCapampaign = async function (req, res) {
  if (!app.freshInstall) {
    return res.redirect("/");
  }

  req.app.debug.server(`Init campaign from ` + req.ip);

  // Actually initialize the campaign with the POST data
  app.queries.addCampaign.run({
    starts: Number(req.body.start),
    expires: Number(req.body.end),
  });
  app.queries.addUser.run({
    user_url: req.body.project_url,
    user_image: req.body.image_url,
    user_alias: req.body.recipient_name,
    user_address: req.body.bch_address,
    data_signature: null
  });
  app.queries.addRecipientToCampaign.run({
    user_id: 1,
    campaign_id: 1,
    recipient_satoshis: Number(req.body.amount) * 100000000
  });
  // Handle description

  // IMPORTANT: do not let the user access this page again
  // and redirect to home if they try
  app.freshInstall = false;

  // Render a success message
  return res.redirect("/");
  res.end();

  req.app.debug.server(`Campaign created`);
};

// Call create when this route is requested.
router.get("/", create);
// Init when the form is submitted
router.post("/", initCapampaign);

module.exports = router;
