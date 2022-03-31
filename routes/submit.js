const shared = require("../src/shared.js");
const javascriptUtilities = require("../src/util.js");

// Initialize mutex locking library.
const asyncMutex = require("async-mutex").Mutex;

// initialize a revocation event check lock.
const submissionLock = new asyncMutex();

// Enable support for Express apps.
const express = require("express");
const router = express.Router();

// Load the libauth box library.
const libox = require("../src/libox");

// Enable support for time management.
const moment = require("moment");

// Enable support for assurance contracts.
const assuranceContract = require("../src/assurance.js").Contract;

const calculateMinerFee = function (RECIPIENT_COUNT, CONTRIBUTION_COUNT) {
  // Aim for two satoshis per byte to get a clear margin for error and priority on fullfillment.
  const TARGET_FEE_RATE = 2;

  // Define byte weights for different transaction parts.
  const TRANSACTION_METADATA_BYTES = 10;
  const AVERAGE_BYTE_PER_RECIPIENT = 69;
  const AVERAGE_BYTE_PER_CONTRIBUTION = 296;

  // Calculate the miner fee necessary to cover a fullfillment transaction with the next (+1) contribution.
  const MINER_FEE =
    (TRANSACTION_METADATA_BYTES +
      AVERAGE_BYTE_PER_RECIPIENT * RECIPIENT_COUNT +
      AVERAGE_BYTE_PER_CONTRIBUTION * (CONTRIBUTION_COUNT + 1)) *
    TARGET_FEE_RATE;

  // Return the calculated miner fee.
  return MINER_FEE;
};

// Wrap the submission function in an async function.
const submitContribution = async function (req, res) {
  // Get a mutex lock ready.
  const unlock = await submissionLock.acquire();

  try {
    // Notify the server admin that a contribution has been received.
    req.app.debug.server("New contribution delivered from " + req.ip);
    req.app.debug.object(req.body);

    const campaignId = Number(req.params["campaign_id"]);

    // Validate and store contribution.
    try {
      // Parse contribution.
      const contributionObject = req.body;

      // Get the campaign information..
      const campaign = req.app.queries.getCampaign.get({
        campaign_id: campaignId,
      });

      // If there is no matching campaign..
      if (typeof campaign === "undefined") {
        // Send an BAD REQUEST signal back to the client.
        res.status(400).json({
          error: `Campaign (${req.params["campaign_id"]}) does not exist.`,
        });

        // Notify the admin about the event.
        req.app.debug.server(
          "Contribution rejection (Missing campaign) returned to " + req.ip
        );

        // Return false to indicate failure and stop processing.
        return false;
      }

      // Check if the campaign has already been fullfilled.
      if (campaign.fullfillment_id) {
        // Send an BAD REQUEST signal back to the client.
        res.status(400).json({
          error: `Campaign (${req.params["campaign_id"]}) has already been fullfilled.`,
        });

        // Notify the admin about the event.
        req.app.debug.server(
          "Contribution rejection (Fullfilled campaign) returned to " + req.ip
        );

        // Return false to indicate failure and stop processing.
        return false;
      }

      // Check if the campaign has already expired.
      if (moment().unix() >= campaign.expires) {
        // Send an BAD REQUEST signal back to the client.
        res.status(400).json({
          error: `Campaign (${req.params["campaign_id"]}) has expired.`,
        });

        // Notify the admin about the event.
        req.app.debug.server(
          "Contribution rejection (Expired campaign) returned to " + req.ip
        );

        // Return false to indicate failure and stop processing.
        return false;
      }

      // Check if the campaign has not yet started.
      if (moment().unix() < campaign.starts) {
        // Send an BAD REQUEST signal back to the client.
        res.status(400).json({
          error: `Campaign (${req.params["campaign_id"]}) has not yet started.`,
        });

        // Notify the admin about the event.
        req.app.debug.server(
          "Contribution rejection (Pending campaign) returned to " + req.ip
        );

        // Return false to indicate failure and stop processing.
        return false;
      }

      // TODO: do something about the storage stuffies.
      let contract = new assuranceContract({});

      // Get a list of all recipients for the campaign.
      const recipients = req.app.queries.listRecipientsByCampaign.all({
        campaign_id: campaignId,
      });

      // Add each recipient as outputs.
      for (const recipientIndex in recipients) {
        contract.addOutput(
          recipients[recipientIndex].recipient_satoshis,
          recipients[recipientIndex].user_address
        );
      }

      // Get currently committed information.
      const currentCommittedSatoshis = req.app.queries.getCampaignCommittedSatoshis.get(
        { campaign_id: campaignId }
      ).committed_satoshis;
      const currentContributionCount = req.app.queries.countCommitmentsByCampaign.get(
        { campaign_id: campaignId }
      ).commitment_count;
      const currentMinerFee = calculateMinerFee(
        recipients.length,
        currentContributionCount
      );

      // Set up a filter function that..
      const filterOnCampaign = function (contribution) {
        // Return true if the contribution has not been revoced AND is from the correct campaign.
        return (
          !contribution.revocation_id &&
          contribution.campaign_id === campaignId
        );
      };

      let newCommitments = [];
      let totalSatoshis = 0;

      let refundToken = null;

      // For each input committed..
      for (const inputIndex in contributionObject.inputs) {
        const currentInput = contributionObject.inputs[inputIndex];

        // Fetch the referenced transaction.
        const inputTransaction = await req.app.electrum.request(
          "blockchain.transaction.get",
          currentInput.previous_output_transaction_hash,
          true
        );

        // Check if the transaction has error code 2 (missing UTXO).
        if (inputTransaction.code === 2) {
          // Send an "NOT FOUND" signal back to the client.
          res.status(404).json({
            status: `The UTXO ('${currentInput.previous_output_transaction_hash}') could not be verified as unspent.`,
          });

          // Notify the admin about the event.
          req.app.debug.server(
            "Contribution rejection (Missing transaction) returned to " + req.ip
          );

          // Return false to indicate failure and stop processing.
          return false;
        }

        // Store the inputs value.
        const inputSatoshis =
          inputTransaction.vout[currentInput.previous_output_index].value *
          shared.SATS_PER_BCH;

        // Add this inputs satoshis to the total amount.
        totalSatoshis += inputSatoshis;

        // Store the inputs lockscript.
        const inputLockScript = Buffer.from(
          inputTransaction.vout[currentInput.previous_output_index].scriptPubKey
            .hex,
          "hex"
        );

        // Hash the inputs lockscript to use for requesting UTXOs (Why can't electrum take the UTXO directly and give me info about it???)
        const inputLockScriptHash = libox.Crypto.sha256(inputLockScript);

        // Get a list of unspent outputs for the input address.
        const inputUTXOs = await req.app.electrum.request(
          "blockchain.scripthash.listunspent",
          javascriptUtilities.reverseBuf(inputLockScriptHash).toString("hex")
        );

        // Locate the UTXO in the list of unspent transaction outputs.
        const inputUTXO = inputUTXOs.find(
          (utxo) =>
            utxo.tx_hash === currentInput.previous_output_transaction_hash
        );

        // Verify that we can find the UTXO.
        if (typeof inputUTXO === "undefined") {
          // Send an "NOT FOUND" signal back to the client.
          res.status(404).json({
            status: `The UTXO ('${currentInput.previous_output_transaction_hash}') could not be verified as unspent.`,
          });

          // Notify the admin about the event.
          req.app.debug.server(
            "Contribution rejection (Missing UTXO) returned to " + req.ip
          );

          // Return false to indicate failure and stop processing.
          return false;
        }

        //
        const previousTransactionHash = Buffer.from(
          currentInput.previous_output_transaction_hash,
          "hex"
        );

        //
        let previousTransactionOutputIndex =
          assuranceContract.encodeOutputIndex(
            currentInput.previous_output_index
          );

        //
        const previousTransactionOutputValue =
          assuranceContract.encodeOutputValue(inputUTXO.value);

        //
        const previousTransactionUnlockScript = Buffer.from(
          currentInput.unlocking_script,
          "hex"
        );

        // Validate commitment signature
        const verificationMessage = contract.assembleSighashDigest(
          previousTransactionHash,
          previousTransactionOutputIndex,
          previousTransactionOutputValue,
          inputLockScript
        );

        // For now, we only support contributions that come from P2PKH scripts.
        const verificationParts = assuranceContract.parseKeyHashUnlockScript(
          previousTransactionUnlockScript
        );

        const verificationStatus = libox.Signature.verifyDER(
          // remove signature type from last byte
          Uint8Array.from(verificationParts.signature).slice(0, -1),
          Uint8Array.from(verificationParts.publicKey),
          Uint8Array.from(verificationMessage)
        );


        // If the signature verfication failed..
        if (!verificationStatus) {
          throw "signature verification failed.";
        }

        // Store commitment to database.
        const storeCommitmentResult = req.app.queries.addCommitment.run({
          previous_transaction_hash: Buffer.from(
            currentInput.previous_output_transaction_hash,
            "hex"
          ),
          previous_transaction_index: currentInput.previous_output_index,
          unlock_script: Buffer.from(currentInput.unlocking_script, "hex"),
          sequence_number: 0xffffffff,
          satoshis: inputUTXO.value,
        });

        // If we have not yet subscribed to this script hash..
        if (
          !req.app.subscribedScriptHashes[
            javascriptUtilities.reverseBuf(inputLockScriptHash).toString("hex")
          ]
        ) {
          // Mark this scripthash as subscribed to.
          req.app.subscribedScriptHashes[
            javascriptUtilities.reverseBuf(inputLockScriptHash).toString("hex")
          ] = true;

          // blockchain.scripthash.subscribe
          req.app.electrum.subscribe(
            req.app.handleRevocations,
            "blockchain.scripthash.subscribe",
            javascriptUtilities.reverseBuf(inputLockScriptHash).toString("hex")
          );

          //
          req.app.debug.struct(
            "Subscribed to changes for commitment ",
            storeCommitmentResult.lastInsertRowid
          );
        }

        //
        newCommitments.push(storeCommitmentResult.lastInsertRowid);
      }

      // Verify that contributed amount matches stated intent.
      if (contributionObject.data.amount !== Math.round(totalSatoshis)) {
        // Send an CONFLICT signal back to the client.
        res.status(409).json({
          status: `The contribution amount ('${Math.round(
            totalSatoshis
          )}') does not match the provided intent (${
            contributionObject.data.amount
          }).`,
        });

        // Notify the admin about the event.
        req.app.debug.server(
          "Contribution rejection (intent amount mismatch) returned to " +
          req.ip
        );

        // Return false to indicate failure and stop processing.
        return false;
      }

      // Calculate the minimum donation amount.
      const remainingValue = currentMinerFee + (contract.totalContractOutputValue - currentCommittedSatoshis);
      const currentFloor = (function() {
          // Load all relevant existing contributions to calculate the floor.
          const campaignContributions = req.app.queries.listAllContributions.all();
          const relevantContributions = campaignContributions.filter(filterOnCampaign);

          shared.calculateMinimumDonation(relevantContributions, remainingValue);
      })();

      // Verify that the current contribution does not undercommit the contract floor.
      if (totalSatoshis < currentFloor) {
        // Send an BAD REQUEST signal back to the client.
        res.status(400).json({
          status: `The contribution amount ('${Math.round(
            totalSatoshis
          )}') undercommits the current floor of (${currentFloor}) satoshis.`,
        });

        // Notify the admin about the event.
        req.app.debug.server(
          "Contribution rejection (amount undercommitment) returned to " +
          req.ip
        );

        // Return false to indicate failure and stop processing.
        return false;
      }

      // Calculate how far over (or under) committed this contribution makes the contract.
      const overCommitment = Math.round(
        currentCommittedSatoshis +
        totalSatoshis -
        (contract.totalContractOutputValue + currentMinerFee)
      );

      // Verify that the current contribution does not overcommit the contract.
      if (overCommitment > 0) {
        // Send an BAD REQUEST signal back to the client.
        res.status(400).json({
          status: `The contribution amount ('${Math.round(
            totalSatoshis
          )}') overcommits the contract by (${overCommitment}) satoshis.`,
        });

        // Notify the admin about the event.
        req.app.debug.server(
          "Contribution rejection (amount overcommitment) returned to " + req.ip
        );

        // Return false to indicate failure and stop processing.
        return false;
      }

      // Store the user to the database.
      const storeUserResult = req.app.queries.addUser.run({
        user_url: null,
        user_image: null,
        user_alias: contributionObject.data.alias,
        user_address: null,
        data_signature: null,
      });

      // Store the contribution to the database.
      const storeContributionResult = req.app.queries.addContributionToCampaign.run(
        {
          user_id: storeUserResult.lastInsertRowid,
          campaign_id: campaignId,
          contribution_comment: contributionObject.data.comment,
          contribution_timestamp: moment().unix(),
        }
      );

      // Link each commitment to the contribution.
      for (const index in newCommitments) {
        req.app.queries.linkCommitmentToContribution.run({
          commitment_id: newCommitments[index],
          contribution_id: storeContributionResult.lastInsertRowid,
        });
      }

      // Create a refund token to be broadcast upon expiration.
      for (const index in newCommitments) {
        const commitmentId = newCommitments[index];
        const token = (function() {
          const encoder = new TextEncoder();
          const preImage = encoder.encode(commitmentId + ":" + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
          const buffer = libox.Crypto.hash256(preImage);
          return javascriptUtilities.toHexString(buffer);
        })();

        req.app.queries.createRefundTransaction.run({
          token: token,
          commitment_id: commitmentId
        });

        // NOTE: There can technically be multiple refund tokens created, but the web wallet only supports one.
        refundToken = token;
      }


      // Reload all of the campaign contributions (including the newest contribution).
      const updatedCampaignContributions = req.app.queries.listAllContributions.all();
      const updatedRelevantContributions = updatedCampaignContributions.filter(filterOnCampaign);

      // Update the initial push for the SSE stream.
      req.app.sse.updateInit(updatedCampaignContributions);

      // Get the currently added contribution.
      const contributionData = req.app.queries.getContribution.get({
        contribution_id: storeContributionResult.lastInsertRowid,
      });

      // Push the contribution to the SSE stream.
      req.app.sse.send(contributionData);

      // Add relevant contributions to the contract..
      for (const contributionIndex in updatedRelevantContributions) {
        const commitment = updatedRelevantContributions[contributionIndex];

        const commitmentObject = {
          previousTransactionHash: commitment.previous_transaction_hash,
          previousTransactionOutputIndex: commitment.previous_transaction_index,
          unlockScript: commitment.unlock_script,
          sequenceNumber: commitment.sequence_number,
          value: commitment.satoshis,
        };

        contract.addCommitment(commitmentObject);
      }

      // Fullfill contract if possible.
      if (contract.remainingCommitmentValue === 0) {
        // Get a mutex lock for transaction updates ready.
        // NOTE: This ensures that the broadcasted fullfillment gets stored in the database
        //       before the revocations for it can be processed, avoidin invalid UI updates.
        const unlock = await req.app.checkForTransactionUpdatesLock.acquire();

        try {
          // Assemble commitments into transaction
          const rawTransaction = contract.assembleTransaction();

          // Broadcast transaction
          const broadcastResult = await req.app.electrum.request(
            "blockchain.transaction.broadcast",
            rawTransaction.toString("hex")
          );

          const wasSuccess = (Object.keys(broadcastResult).length > 0); // electrum.request returns an empty object upon failure and the txn's hex upon success.

          // If we successfully broadcasted the transaction..
          if (wasSuccess) {
            // structure a fullfillment object.
            const fullfillmentObject = {
              fullfillment_timestamp: moment().unix(),
              fullfillment_transaction: broadcastResult,
              campaign_id: campaignId,
            };

            // Store the fullfillment in the database.
            req.app.queries.addCampaignFullfillment.run(fullfillmentObject);

            // Push the fullfillment to the SSE stream.
            req.app.sse.send(fullfillmentObject);

            // Notify the server admin that a campaign has been fullfilled.
            req.app.debug.action(
              `Fullfilled campaign #${req.params["campaign_id"]} with transaction ${broadcastResult}`
            );
          }
          else {
            console.log("Unable to broadcast fulfillment transaction: " + JSON.stringify(broadcastResult));
          }
        } finally {
          // Unlock the mutex so the next process can continue.
          unlock();
        }
      }

      // Notify the server admin that a contribution has been accepted.
      req.app.debug.server("Contribution acceptance confirmed to " + req.ip);

      // Send an OK signal back to the client.
      res.status(200).json({ status: "ok", refundToken: refundToken });
    } catch (error) {
      console.log(error);
      // Send an ERROR signal back to the client.
      res.status(500).json({ error: error });

      req.app.debug.errors("Failed to validate contribution.");
      req.app.debug.object(error);
    }
  } finally {
    // Unlock the mutex so the next process can continue.
    unlock();
  }
};

// Call submitContribution when this route is requested.
router.post("/:campaign_id/", submitContribution);

module.exports = router;
