// Enable support for Express apps.
const express = require('express');
const router = express.Router();

var renderer = require('../src/renderer.js');

// Wrap the campaign request in an async function.
const home = async function(req, res)
{
    // Notify the server admin that a campaign has been requested.
    req.app.debug.server(`Home page requested from ` + req.ip);

    // Render HTML
    renderer.view('header.html', {}, res);
    renderer.view('footer.html', {}, res);
    res.end();

    // Notify the server admin that a campaign has been requested.
    req.app.debug.server(`Home page delivered to ` + req.ip);
};

// Call home when this route is requested.
router.get('/', home);

module.exports = router;

