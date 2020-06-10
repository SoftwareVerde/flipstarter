// Import filesystem module to read HTML files
const fs = require("fs");

function view(templateName, res) {
  // Read from template file
  const content = fs.readFileSync("./views/" + templateName);

  res.write(content);
}

module.exports.view = view;
