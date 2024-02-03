module.exports = async function (app) {
  //
  app.debug.struct("Initializing network module.");

  // Load the electrum library.
  const { ElectrumCluster } = require("electrum-cash");

  // Initialize an electrum cluster with default settings.
  app.electrum = new ElectrumCluster("Flipstarter Backend", "1.4.1");

  //
  app.debug.struct("Adding servers to cluster.");

  // Add some servers to the cluster.
  app.electrum.addServer("bch.imaginary.cash");
  app.electrum.addServer("electrum.imaginary.cash");

  // Allow unlimited event listeners (i.e. blockchain.scripthash.subscribe)
  for (let i in app.electrum.clients) {
    const electrumClient = app.electrum.clients[i].connection;
    electrumClient.setMaxListeners(0);
  }

  //
  app.debug.struct("Waiting for sufficient connectivity.");

  // Wait for enough connections to be available.
  await app.electrum.ready();

  //
  app.debug.struct("Cluster is now active.");

  // Notify the user that logging has been initialized.
  app.debug.status("Completed network initialization.");
};
