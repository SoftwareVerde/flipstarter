// Enable support for Express apps.
const express = require("express");
const router = express.Router();
const app = require("../server.js");
const languages = require("../static/ui/languages.json");

const renderer = require("../src/renderer.js");
const fs = require("fs");
const { marked } = require("marked");

// Wrap the campaign request in an async function.
const home = async function (req, res) {
  // Notify the server admin that a campaign has been requested.
  req.app.debug.server("Home page requested from " + req.ip);

  // Redirect to campaign creation page if no campaign was created
  if (app.freshInstall) {
    return res.redirect("/create");
  }

  // get campaign data
  const campaign = req.app.queries.getCampaign.get({
    campaign_id: 1,
  });

  // path will be /lang
  const path = req.route.path;

  // slice path to get lang name
  let lang = path.slice(1);

  // use default language if page in root
  if (!lang) {
    lang = campaign.default_language;
  }

  // Redirect to / page if languages not support in this campaigns
  if (!campaign.available_languages.split(",").includes(lang)) {
    return res.redirect("/");
  }

  // Read abstract from page languages to add it in description
  let descriptionFile = fs.readFileSync("./static/campaigns/1/" + lang + "/abstract.md");

  // Convert file to String
  let description = descriptionFile.toString();

  // Render HTML
  renderer.view("index.html", res, {
    "<!-- campaign.title -->": campaign.title,
    // Marked and remove html tags
    "<!-- campaign.description -->": marked.parse(description)
      .replace(/<[^>]*>?/gm, "")
      .trim(),
    "<!-- campaign.lang -->": lang
  });

  res.end();
  // Notify the server admin that a campaign has been requested.
  req.app.debug.server("Home page delivered to " + req.ip);
};

// Call home when this route is requested.
router.get("/", home);

// Support /:lang of flipstarter languages
for (let lang in languages) {
  router.get("/" + lang, home);
}

module.exports = router;
