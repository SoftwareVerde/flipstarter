// Import filesystem module to read HTML files
const fs = require("fs");

function view(templateName, res, replaces = {}) {
  // Read from template file
  let content = fs.readFileSync("./views/" + templateName).toString();
  for (let key in replaces) {
    content = content.split(key).join(replaces[key]);
  }

  res.write(content);
}

module.exports.view = view;
