// Enable support for time management.
const moment = require("moment");

// Load the bitbox library.
const bitboxSDK = require("bitbox-sdk");
const bitbox = new bitboxSDK.BITBOX();

class javascriptUtilities {
  /**
   * Reverses a Buffers content
   *
   * @param source   the Buffer to reverse
   *
   * @returns a new Buffer with the contents reversed.
   */
  static reverseBuf(source) {
    // Allocate space for the reversed buffer.
    let reversed = Buffer.allocUnsafe(source.length);

    // Iterate over half of the buffers length, rounded up..
    for (
      let lowIndex = 0, highIndex = source.length - 1;
      lowIndex <= highIndex;
      lowIndex += 1, highIndex -= 1
    ) {
      // .. and swap each position from the beggining to the end.
      reversed[lowIndex] = source[highIndex];
      reversed[highIndex] = source[lowIndex];
    }

    // Return the reversed buffer.
    return reversed;
  }
}

// Initialize mutex locking library.
const asyncMutex = require("async-mutex").Mutex;

// Include support for express applications.
const express = require("express");
const SSE = require("express-sse");

// Create an instance of an express application.
const app = express();

// Add support for Cross-Origin settings.
const cors = require("cors");

// Add support for parsing POST bodies.
const bodyParser = require("body-parser");
const urlencodedParser = bodyParser.urlencoded({ extended: false });

// Wrap application setup in order to allow async/await.
const setup = async function () {
  // Enable parsing of both JSON and URL-encoded bodies.
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // Create a server-sent event stream.
  app.sse = new SSE();

  // Load the configuration file.
  app.config = require("./config.js");

  // Read the package information file.
  app.software = require("./package.json");

  // Load application modules.
  await require("./src/logging.js")(app);
  await require("./src/storage.js")(app);
  await require("./src/network.js")(app);

  module.exports = app;

  //
  app.debug.struct("Configuring services.");

  // Configure CORS an Express settings.
  app.use(cors());
  app.use(express.json());

  // Ask express to parse proxy headers.
  app.enable("trust proxy");

  // Configure express to prettify json.
  app.set("json spaces", 2);

  // Create routes from separate files.
  app.use("/submit", require("./routes/submit.js"));
  app.use("/campaign", require("./routes/campaign.js"));
  app.use("/", require("./routes/home.js"));
  app.use("/create", urlencodedParser, require("./routes/create.js"));

  // Serve static files
  app.use("/static", express.static("static"));

  // Event handling
  app.get("/events", app.sse.init);

  // Initialize an empty set of scripthashes that we are subscribed to.
  app.subscribedScriphashes = {};

  // initialize a revocation event check lock.
  app.handleRevocationsLock = new asyncMutex();

  //
  app.handleRevocations = async function (data) {
    // Check if the notification is a status update.
    if (Array.isArray(data)) {
      // Get the script hash.
      const scriptHash = data[0];
      const scriptHashStatus = data[1];

      // Get a list of unspent outputs for the input address.
      const transactions = await app.electrum.request(
        "blockchain.scripthash.get_history",
        scriptHash
      );

      // Get a mutex lock ready.
      const unlock = await app.handleRevocationsLock.acquire();

      try {
        // If this event is new or has a changed scripthash status..
        if (app.subscribedScriphashes[scriptHash] !== scriptHashStatus) {
          // Update this scripthash status to prevent redundant work..
          app.subscribedScriphashes[scriptHash] = scriptHashStatus;

          // For each transaction for this scripthash..
          for (const transactionIndex in transactions) {
            // get the transaction hash for this historic transaction.
            const transactionHash = transactions[transactionIndex].tx_hash;

            // Check the historic transaction to see if we need to update our revocation status.
            app.checkForTransactionUpdates(Buffer.from(transactionHash, "hex"));
          }
        }
      } finally {
        // Unlock the mutex so the next process can continue.
        unlock();
      }
    }
  };

  // initialize a transaction revocation check lock.
  app.checkForTransactionUpdatesLock = new asyncMutex();

  //
  app.checkForTransactionUpdates = async function (transactionHash) {
    if (!transactionHash) {
      return false;
    }

    // Fetch the referenced transaction.
    const currentTransaction = await app.electrum.request(
      "blockchain.transaction.get",
      transactionHash.toString("hex"),
      true
    );

    // For each of the transactions ouputs..
    for (const outputIndex in currentTransaction.vout) {
      // Try to find a commitment in the database.
      const commitment = app.queries.getCommitmentByHashAndIndex.get({
        previous_transaction_hash: transactionHash,
        previous_transaction_index: outputIndex,
      });

      // If a commitment was found, and it has not already been revoked..
      if (typeof commitment !== "undefined" && !commitment.revocation_id) {
        // Get a mutex lock ready.
        const unlock = await app.checkForTransactionUpdatesLock.acquire();

        try {
          // Store the inputs lockscript.
          const inputLockScript = Buffer.from(
            currentTransaction.vout[outputIndex].scriptPubKey.hex,
            "hex"
          );

          // Hash the inputs lockscript to use for requesting UTXOs (Why can't electrum take the UTXO directly and give me info about it???)
          const inputLockScriptHash = bitbox.Crypto.sha256(inputLockScript);

          // Get a list of unspent outputs for the input address.
          const inputUTXOs = await app.electrum.request(
            "blockchain.scripthash.listunspent",
            javascriptUtilities.reverseBuf(inputLockScriptHash).toString("hex")
          );

          // Locate the UTXO in the list of unspent transaction outputs.
          const inputUTXO = inputUTXOs.find(
            (utxo) => utxo.tx_hash === transactionHash.toString("hex")
          );

          // Validate the that referenced transaction output is unspent...
          if (typeof inputUTXO === "undefined") {
            // Mark the commitment as revoked.
            app.queries.addContributionRevocation.run({
              revocation_timestamp: moment().unix(),
              revocation_transaction: transactionHash.toString("hex"),
              commitment_id: commitment.commitment_id,
            });

            // Get an updates list of contributions.
            const campaignContributions = app.queries.listAllContributions.all();

            // Update the initial push for the SSE stream.
            app.sse.updateInit(campaignContributions);

            // Get the currently added contribution.
            const contributionData = app.queries.getContributionByCommitment.get(
              { commitment_id: commitment.commitment_id }
            );

            // Check that the revocation isn't for a fullfilled campaign, if it was found.
            if (
              typeof contributionData !== "undefined" &&
              !contributionData.fullfillment_id
            ) {
              // Push the contribution to the SSE stream.
              app.sse.send(contributionData);
            }

            // If we are currently subscribed to changes for this script hash..
            if (
              app.subscribedScriphashes[
                javascriptUtilities
                  .reverseBuf(inputLockScriptHash)
                  .toString("hex")
              ]
            ) {
              // Mark this scripthash as no longer subscribed to.
              app.subscribedScriphashes[
                javascriptUtilities
                  .reverseBuf(inputLockScriptHash)
                  .toString("hex")
              ] = false;

              // Unsubscribe to changes for this output.
              app.electrum.request(
                "blockchain.scripthash.unsubscribe",
                javascriptUtilities
                  .reverseBuf(inputLockScriptHash)
                  .toString("hex")
              );
            }

            // Notify user that the service is ready for incoming connections.
            app.debug.action(
              `Marked spent commitment '${commitment.commitment_id}' as revoked.`
            );
          } else if (
            !app.subscribedScriphashes[
              javascriptUtilities
                .reverseBuf(inputLockScriptHash)
                .toString("hex")
            ]
          ) {
            // Mark this scripthash as subscribed to.
            app.subscribedScriphashes[
              javascriptUtilities
                .reverseBuf(inputLockScriptHash)
                .toString("hex")
            ] = true;

            // Subscribe to changes for this output.
            await app.electrum.subscribe(
              app.handleRevocations,
              "blockchain.scripthash.subscribe",
              javascriptUtilities
                .reverseBuf(inputLockScriptHash)
                .toString("hex")
            );

            // Notify user that the service is ready for incoming connections.
            app.debug.struct(
              `Subscribed to changes for commitment '${commitment.commitment_id}'.`
            );
          }
        } finally {
          // Unlock the mutex so the next process can continue.
          unlock();
        }
      }
    }
  };

  // Get a list of all contributions for all campaigns.
  const unverifiedContributions = app.queries.listAllContributions.all();

  // Notify user that the service is ready for incoming connections.
  app.debug.struct(
    `Verifying a total of '${
      Object.keys(unverifiedContributions).length
    }' existing contributions.`
  );

  // Store verification promises to allow parallellization.
  let verificationPromises = [];

  // Check each contributions commitment..
  for (const contributionIndex in unverifiedContributions) {
    if (!unverifiedContributions[contributionIndex].revocation_id) {
      console.log("CI", contributionIndex);
      verificationPromises.push(
        app.checkForTransactionUpdates(
          unverifiedContributions[contributionIndex].previous_transaction_hash
        )
      );
    }
  }

  // Wait for all verifications to complete.
  await Promise.all(verificationPromises);

  // Get a list of all contributions for all campaigns.
  const verifiedContributions = app.queries.listAllContributions.all();

  // Update the initial SSE stream with the contributions.
  app.sse.updateInit(verifiedContributions);

  //
  // app.use('/status', require('./routes/status.js'));

  // Listen to incoming connections on port X.
  app.listen(app.config.server.port, "0.0.0.0");

  // Notify user that the service is ready for incoming connections.
  app.debug.status(
    "Listening for incoming connections on port " + app.config.server.port
  );
};

// Initialize the server.
setup();
