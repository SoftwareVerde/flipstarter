// Initialize mutex locking library.
const asyncMutex = require("async-mutex").Mutex;

// initialize a revocation event check lock.
const submissionLock = new asyncMutex();

// Enable support for Express apps.
const express = require("express");
const router = express.Router();

// Load the bitbox library.
const bitboxSDK = require("bitbox-sdk");
const bitbox = new bitboxSDK.BITBOX();

// Load the bitbox backend depency directly to get access to unexposed class necessary for signature verification.
const ECSignature = require("@bitcoin-dot-com/bitcoincashjs2-lib").ECSignature;

// Enable support for time management.
const moment = require("moment");

// Enable support for assurance contracts.
const assuranceContract = require("../src/assurance.js").Contract;

const SATS_PER_BCH = 100000000;

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

    // Validate and store contribution.
    try {
      // Parse contribution.
      const contributionObject = req.body;

      // Get the campaign information..
      const campaign = req.app.queries.getCampaign.get({
        campaign_id: Number(req.params["campaign_id"]),
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
        campaign_id: Number(req.params["campaign_id"]),
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
        { campaign_id: Number(req.params["campaign_id"]) }
      ).committed_satoshis;
      const currentContributionCount = req.app.queries.countCommitmentsByCampaign.get(
        { campaign_id: Number(req.params["campaign_id"]) }
      ).commitment_count;
      const currentMinerFee = calculateMinerFee(
        recipients.length,
        currentContributionCount
      );

      let newCommitments = [];
      let totalSatoshis = 0;

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
          SATS_PER_BCH;

        // Add this inputs satoshis to the total amount.
        totalSatoshis += inputSatoshis;

        // Store the inputs lockscript.
        const inputLockScript = Buffer.from(
          inputTransaction.vout[currentInput.previous_output_index].scriptPubKey
            .hex,
          "hex"
        );

        // Hash the inputs lockscript to use for requesting UTXOs (Why can't electrum take the UTXO directly and give me info about it???)
        const inputLockScriptHash = bitbox.Crypto.sha256(inputLockScript);

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
        let previousTransactionOutputIndex = assuranceContract.encodeOutputIndex(
          currentInput.previous_output_index
        );

        //
        const previousTransactionOutputValue = assuranceContract.encodeOutputValue(
          inputUTXO.value
        );

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
        const verificationParts = assuranceContract.parseKeyHashUnlockScript(
          previousTransactionUnlockScript
        );
        const verificationKey = bitbox.ECPair.fromPublicKey(
          verificationParts.publicKey
        );
        const verificationSignature = ECSignature.parseScriptSignature(
          verificationParts.signature
        ).signature;
        const verificationStatus = bitbox.ECPair.verify(
          verificationKey,
          verificationMessage,
          verificationSignature
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
          !req.app.subscribedScriphashes[
            javascriptUtilities.reverseBuf(inputLockScriptHash).toString("hex")
          ]
        ) {
          // Mark this scripthash as subscribed to.
          req.app.subscribedScriphashes[
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

      // Define a helper function we need to calculate the floor.
      const inputPercentModifier = async function (inputPercent) {
        const commitmentsPerTransaction = 650;

        // Calculate how many % of the total fundraiser the smallest acceptable contribution is at the moment.
        const remainingValue =
          currentMinerFee +
          (contract.totalContractOutputValue - currentCommittedSatoshis);

        const currentTransactionSize = 42; // this.contract.assembleTransaction().byteLength;

        const minPercent =
          0 +
          (remainingValue /
            (commitmentsPerTransaction - currentContributionCount) +
            546 / SATS_PER_BCH) /
          remainingValue;
        const maxPercent =
          1 -
          ((currentTransactionSize + 1650 + 49) * 1.0) /
          (remainingValue * SATS_PER_BCH);

        // ...
        const minValue = Math.log(minPercent * 100);
        const maxValue = Math.log(maxPercent * 100);

        // Return a percentage number on a non-linear scale with higher resolution in the lower boundaries.
        return (
          Math.exp(minValue + (inputPercent * (maxValue - minValue)) / 100) /
          100
        );
      };

      // Calculate the current floor
      const currentFloor = Math.ceil(
        (contract.totalContractOutputValue +
          currentMinerFee -
          currentCommittedSatoshis) *
        (await inputPercentModifier(0.75))
      );

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
          campaign_id: Number(req.params["campaign_id"]),
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

      // Get an updates list of contributions.
      const campaignContributions = req.app.queries.listAllContributions.all();

      // Update the initial push for the SSE stream.
      req.app.sse.updateInit(campaignContributions);

      // Get the currently added contribution.
      const contributionData = req.app.queries.getContribution.get({
        contribution_id: storeContributionResult.lastInsertRowid,
      });

      // Push the contribution to the SSE stream.
      req.app.sse.send(contributionData);

      // Set up a filter function that..
      const filterOnCampaign = function (contribution) {
        // Return true if the contribution has not been revoced AND is from the correct campaign.
        return (
          !contribution.revocation_id &&
          contribution.campaign_id === Number(req.params["campaign_id"])
        );
      };

      // Filter out irrelevant contributions.
      const relevantContributions = campaignContributions.filter(
        filterOnCampaign
      );

      // Add relevant contributions to the contract..
      for (const currentContribution in relevantContributions) {
        const commitment = relevantContributions[currentContribution];

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

          // If we successfully broadcasted the transaction..
          if (broadcastResult) {
            // structure a fullfillment object.
            const fullfillmentObject = {
              fullfillment_timestamp: moment().unix(),
              fullfillment_transaction: broadcastResult,
              campaign_id: Number(req.params["campaign_id"]),
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
        } finally {
          // Unlock the mutex so the next process can continue.
          unlock();
        }
      }

      // Notify the server admin that a contribution has been accepted.
      req.app.debug.server("Contribution acceptance confirmed to " + req.ip);

      // Send an OK signal back to the client.
      res.status(200).json({ status: "ok" });
    } catch (error) {
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
