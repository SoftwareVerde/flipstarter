module.exports = {
  //
  server: {
    // Which port the server should listen for requests on.
    port: process.env.PORT || 3000,

    // Where to store the servers database file(s).
    // Express serve-static ignores files whose names begin with a dot
    // This avoids making the database available on a public URL.
    database: "./static/campaigns/.database.db",
  },
};
