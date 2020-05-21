module.exports = function (app) {
  // Enable support for configurable debugging.
  app.debug = {
    // Action logs
    action: require("debug")("flipstarter:action"),

    // Errors log problems that happen internally.
    errors: require("debug")("flipstarter:errors"),

    // Result logs block, transaction and registration results.
    result: require("debug")("flipstarter:result"),

    // Object logs full data structures.
    object: require("debug")("flipstarter:object"),

    // Server logs interactions with clients.
    server: require("debug")("flipstarter:server"),

    // Status logs changes to the servers operational mode.
    status: require("debug")("flipstarter:status"),

    // Struct logs operational progress.
    struct: require("debug")("flipstarter:struct"),
  };

  // Notify the user that logging has been initialized.
  app.debug.status("Completed logging initialization.");
};
