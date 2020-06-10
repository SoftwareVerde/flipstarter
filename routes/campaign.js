// Enable support for Express apps.
const express = require("express");
const router = express.Router();

// Wrap the campaign request in an async function.
const campaignInformation = async function (req, res) {
  // Notify the server admin that a campaign has been requested.
  req.app.debug.server(
    `Campaign #${req.params["campaign_id"]} data requested from ` + req.ip
  );
  req.app.debug.object(req.params);

  // Fetch the campaign data.
  const campaign = req.app.queries.getCampaign.get({
    campaign_id: req.params["campaign_id"],
  });
  const recipients = req.app.queries.listRecipientsByCampaign.all({
    campaign_id: req.params["campaign_id"],
  });

  const result = {
    campaign: campaign,
    recipients: recipients,
  };

  // Send the payment request data.
  res.status(200).json(result);

  // Notify the server admin that a campaign has been requested.
  req.app.debug.server(
    `Campaign #${req.params["campaign_id"]} data delivered to ` + req.ip
  );
  req.app.debug.object(result);
};

// Call campaignInformation when this route is requested.
router.get("/:campaign_id", campaignInformation);

module.exports = router;
