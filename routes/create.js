// Enable support for Express apps.
const express = require("express");
const router = express.Router();
const app = require("../server.js");
const moment = require("moment");
const fs = require("fs");
const languages = require("../static/ui/languages.json");
const multer  = require("multer");
const upload = multer({ dest: "static/campaigns/.cache" });
const SATS_PER_BCH = 100000000;

const renderer = require("../src/renderer.js");

// Wrap the campaign request in an async function.
const create = async function (req, res) {
  // Notify the server admin that a campaign has been requested.
  req.app.debug.server("Create page requested from " + req.ip);

  if (!app.freshInstall) {
    return res.redirect("/");
  }

  // Render HTML
  renderer.view("create.html", res);
  res.end();

  // Notify the server admin that a campaign has been requested.
  req.app.debug.server("Create page delivered to " + req.ip);
};

const writeDescription = function (languageCode, abstract, proposal) {
  fs.mkdirSync("./static/campaigns/1/" + languageCode, { recursive: true });
  // Handle descripion
  fs.writeFile(
    "./static/campaigns/1/" + languageCode + "/abstract.md",
    abstract,
    function (err) {
      if (err) {
        return console.log(err);
      }
    }
  );
  fs.writeFile(
    "./static/campaigns/1/" + languageCode + "/proposal.md",
    proposal,
    function (err) {
      if (err) {
        return console.log(err);
      }
    }
  );
};

const initCapampaign = async function (req, res) {
  if (!app.freshInstall) {
    return res.redirect("/");
  }

  let photoFile = {};
  for(let index in req.files) {
    /* filed name default image_file[index] */
    let file = req.files[index];

    // extract index "i" from "image_file[i]"
    let recipientStartIndex = file.fieldname.indexOf("[") + 1;
    let recipientEndIndex = file.fieldname.indexOf("]");
    if(recipientStartIndex === 0) throw new Error("photo files incorrect");
    if(recipientEndIndex === -1) throw new Error("photo files incorrect");
    let recipient = file.fieldname.substring(recipientStartIndex, recipientEndIndex);

    /*
    * get MIMEtype ex: myavtar.photo.png
    * split to ["myavtar","photo","png"] then use pop to select last one
    */
    let MIMEtype =  file.originalname.split(".").pop();
    // set new path for images
    let oldPath = "./static/campaigns/.cache/" + file.filename;
    let newPath = "./static/campaigns/photo/avatar-" + recipient + "." + MIMEtype;
    // add new path of image to list to add in database
    photoFile[recipient] = `/static/campaigns/photo/avatar-${recipient}.${MIMEtype}`;
    // rename image to new path
    await new Promise(function (resolve) {
      fs.rename(oldPath, newPath, function(err) {
        if (err) throw err;
        resolve("Rename complete!");
      });
    });
  }

  req.app.debug.server("Init campaign from " + req.ip);

  // Convert date to EPOCH
  let start_date = req.body.start_date;
  start_date = moment(start_date);
  start_date = start_date.unix();

  let end_date = req.body.end_date;
  end_date = moment(end_date);
  end_date = end_date.unix();

  // Actually initialize the campaign with the POST data
  let track_name =  req.body.track_name.trim() || req.body.track_url;
  app.queries.addCampaign.run({
    title: req.body.title,
    track_name,
    track_url: req.body.track_url,
    starts: Number(start_date),
    expires: Number(end_date),
  });
  // Add all Users + Recipients
  const users = req.body.recipient_name;

  for (let i in users) {
    app.queries.addUser.run({
      user_url: req.body.project_url[i],
      user_image: photoFile[i] || req.body.image_url[i],
      user_alias: req.body.recipient_name[i],
      user_address: req.body.bch_address[i],
      data_signature: null,
    });
    app.queries.addRecipientToCampaign.run({
      user_id: Number(i) + 1,
      campaign_id: 1,
      recipient_satoshis: Math.round(Number(req.body.amount[i]) * SATS_PER_BCH), // to satoshis
    });
  }

  // Write in /static/campaigns
  for(let langaugeCode in languages) {
    writeDescription(langaugeCode, req.body["abstract" + langaugeCode.toUpperCase()], req.body["proposal" + langaugeCode.toUpperCase()]);
  }

  // IMPORTANT: do not let the user access this page again
  // and redirect to home if they try
  app.freshInstall = false;

  // Render a success message
  return res.redirect("/");
};

// Call create when this route is requested.
router.get("/", create);
// Init when the form is submitted
router.post("/", upload.any(), initCapampaign);

module.exports = router;
