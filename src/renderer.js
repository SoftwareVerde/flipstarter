// Import filesystem module to read HTML files
var fs = require('fs');

function view(templateName, values, res) {
  // Read from template file
  var content = fs.readFileSync('./views/' + templateName);

  res.write(content);
};

module.exports.view = view;
