// Enable support for Express apps.
const express = require('express');
const router = express.Router();

// Load the bitbox library.
const bitboxSDK = require('bitbox-sdk');
const bitbox = new bitboxSDK.BITBOX();

// Load the bitbox backend depency directly to get access to unexposed class necessary for signature verification.
const ECSignature = require('@bitcoin-dot-com/bitcoincashjs2-lib').ECSignature;

// Enable support for time management.
const moment = require('moment');

// Enable support for assurance contracts.
const assuranceContract = require('../src/assurance.js').Contract;

const SATS_PER_BCH = 100000000;

class javascriptUtilities
{
	/**
	* Reverses a Buffers content
	*
	* @param source   the Buffer to reverse
	*
	* @returns a new Buffer with the contents reversed.
	*/
	static reverseBuf(source)
	{
		// Allocate space for the reversed buffer.
		let reversed = Buffer.allocUnsafe(source.length);

		// Iterate over half of the buffers length, rounded up..
		for(let lowIndex = 0, highIndex = source.length - 1; lowIndex <= highIndex; lowIndex += 1, highIndex -= 1)
		{
			// .. and swap each position from the beggining to the end.
			reversed[lowIndex] = source[highIndex];
			reversed[highIndex] = source[lowIndex];
		}

		// Return the reversed buffer.
		return reversed;
	}
}

// Wrap the submission function in an async function.
const submitContribution = async function(req, res)
{
	// Notify the server admin that a contribution has been received.
	req.app.debug.server('New contribution delivered from ' + req.ip);
	req.app.debug.object(req.body);

	// Validate and store contribution.
	try
	{
		// Parse contribution.
		const contributionObject = req.body;

		// TODO: do something about the storage stuffies.
		let contract = new assuranceContract({});

		// Get a list of all recipients for the campaign.
		const recipients = req.app.queries.listRecipientsByCampaign.all({ campaign_id: req.params['campaign_id'] });

		// Add each recipient as outputs.
		for(const recipientIndex in recipients)
		{
			contract.addOutput(recipients[recipientIndex].recipient_satoshis, recipients[recipientIndex].user_address);
		}

		let newCommitments = [];

		for(const inputIndex in contributionObject.inputs)
		{
			const currentInput = contributionObject.inputs[inputIndex];

			// Fetch the referenced transaction.
			const inputTransaction = await req.app.electrum.request('blockchain.transaction.get', currentInput.previous_output_transaction_hash, true);

			// Store the inputs value.
			const inputSatoshis = inputTransaction.vout[currentInput.previous_output_index].value * SATS_PER_BCH;

			// Store the inputs lockscript.
			const inputLockScript = Buffer.from(inputTransaction.vout[currentInput.previous_output_index].scriptPubKey.hex, 'hex');

			// Hash the inputs lockscript to use for requesting UTXOs (Why can't electrum take the UTXO directly and give me info about it???)
			const inputLockScriptHash = bitbox.Crypto.sha256(inputLockScript);

			// Get a list of unspent outputs for the input address.
			const inputUTXOs = await req.app.electrum.request('blockchain.scripthash.listunspent', javascriptUtilities.reverseBuf(inputLockScriptHash).toString('hex'));

			// Locate the UTXO in the list of unspent transaction outputs.
			const inputUTXO = inputUTXOs.find(utxo => utxo.tx_hash == currentInput.previous_output_transaction_hash);

			// Validate the that referenced UTXO is unspent...
			if(typeof inputUTXO === 'undefined')
			{
				// Send an OK signal back to the client.
				res.status(404).json({ status: `The UTXO ('${currentInput.previous_output_transaction_hash}') could not be verified as unspent.` });

				// Notify the admin about the event.
				req.app.debug.server('Contribution rejection returned to ' + req.ip);

				// Return false to indicate failure and stop processing.
				return false;
			}

			//
			const previousTransactionHash = Buffer.from(currentInput.previous_output_transaction_hash, 'hex');

			//
			let previousTransactionOutputIndex = assuranceContract.encodeOutputIndex(currentInput.previous_output_index)

			//
			const previousTransactionOutputValue = assuranceContract.encodeOutputValue(inputUTXO.value);

			//
			const previousTransactionUnlockScript = Buffer.from(currentInput.unlocking_script, 'hex');

			// Validate commitment signature
			const verificationMessage = contract.assembleSighashDigest(previousTransactionHash, previousTransactionOutputIndex, previousTransactionOutputValue, inputLockScript);
			const verificationParts = assuranceContract.parseKeyHashUnlockScript(previousTransactionUnlockScript);
			const verificationKey = bitbox.ECPair.fromPublicKey(verificationParts.publicKey);
			const verificationSignature = ECSignature.parseScriptSignature(verificationParts.signature).signature;
			const verificationStatus = bitbox.ECPair.verify(verificationKey, verificationMessage, verificationSignature);

			// If the signature verfication failed..
			if(!verificationStatus)
			{
				throw('signature verification failed.');
			}

			// Store commitment to database.
			const storeCommitmentResult = req.app.queries.addCommitment.run
			(
				{
					previous_transaction_hash:  Buffer.from(currentInput.previous_output_transaction_hash, 'hex'),
					previous_transaction_index: currentInput.previous_output_index,
					unlock_script:              Buffer.from(currentInput.unlocking_script, 'hex'),
					sequence_number:            0xFFFFFFFF,
					satoshis:                   inputUTXO.value
				}
			);

			// If we have not yet subscribed to this script hash..
			if(!req.app.subscribedScriphashes[javascriptUtilities.reverseBuf(inputLockScriptHash).toString('hex')])
			{
				// Mark this scripthash as subscribed to.
				req.app.subscribedScriphashes[javascriptUtilities.reverseBuf(inputLockScriptHash).toString('hex')] = true;

				// blockchain.scripthash.subscribe
				req.app.electrum.subscribe(req.app.handleRevocations, 'blockchain.scripthash.subscribe', javascriptUtilities.reverseBuf(inputLockScriptHash).toString('hex'));

				//
				req.app.debug.struct('Subscribed to changes for commitment ', storeCommitmentResult.lastInsertRowid);
			}

			//
			newCommitments.push(storeCommitmentResult.lastInsertRowid);
		}

		// Store the user to the database.
		const storeUserResult = req.app.queries.addUser.run
		(
			{
				user_url: null,
				user_image: null,
				user_alias: contributionObject.data.alias,
				user_address: null,
				data_signature: null
			}
		);

		// Store the contribution to the database.
		const storeContributionResult = req.app.queries.addContributionToCampaign.run
		(
			{
				user_id:					storeUserResult.lastInsertRowid,
				campaign_id:				req.params['campaign_id'],
				contribution_comment:		contributionObject.data.comment,
				contribution_timestamp:		moment().unix(),
			}
		);

		// Link each commitment to the contribution.
		for(const index in newCommitments)
		{
			req.app.queries.linkCommitmentToContribution.run({ commitment_id: newCommitments[index], contribution_id: storeContributionResult.lastInsertRowid });
		}

		// Get an updates list of contributions.
		const campaignContributions = req.app.queries.listAllContributions.all();

		// Update the initial push for the SSE stream.
		req.app.sse.updateInit(campaignContributions);

		// Get the currently added contribution.
		const contributionData = req.app.queries.getContribution.get({ contribution_id: storeContributionResult.lastInsertRowid });

		// Push the contribution to the SSE stream.
		req.app.sse.send(contributionData);

		// Filter out irrelevant contributions.
		const relevantContributions = campaignContributions.filter((contribution) => { return (!contribution.revocation_id && (contribution.campaign_id == req.params['campaign_id'])); });

		// Add relevant contributions to the contract..
		for(const currentContribution in relevantContributions)
		{
			const commitment = relevantContributions[currentContribution];

			const commitmentObject =
			{
				previousTransactionHash: commitment.previous_transaction_hash,
				previousTransactionOutputIndex: commitment.previous_transaction_index,
				unlockScript: commitment.unlock_script,
				sequenceNumber: commitment.sequence_number,
				value: commitment.satoshis
			};

			contract.addCommitment(commitmentObject);
		}

		// Fullfill contract if possible.
		if(contract.remainingCommitmentValue === 0)
		{
			// Assemble commitments into transaction
			const rawTransaction = contract.assembleTransaction();

			// Broadcast transaction
			const broadcastResult = await req.app.electrum.request('blockchain.transaction.broadcast', rawTransaction.toString('hex'));

			// If we successfully broadcasted the transaction..
			if(broadcastResult)
			{
				// structure a fullfillment object.
				const fullfillmentObject =
				{
					fullfillment_timestamp: moment().unix(),
					fullfillment_transaction: broadcastResult,
					campaign_id: req.params['campaign_id']
				}

				// Store the fullfillment in the database.
				req.app.queries.addCampaignFullfillment.run(fullfillmentObject);

				// Push the fullfillment to the SSE stream.
				req.app.sse.send(fullfillmentObject);

				// Notify the server admin that a campaign has been fullfilled.
				req.app.debug.action(`Fullfilled campaign #${req.params['campaign_id']} with transaction ${broadcastResult}`);
			}
		}

		// Notify the server admin that a contribution has been accepted.
		req.app.debug.server('Contribution acceptance confirmed to ' + req.ip);

		// Send an OK signal back to the client.
		res.status(200).json({ status: 'ok' });
	}
	catch(error)
	{
		// Send an ERROR signal back to the client.
		res.status(500).json({ error: error });

		req.app.debug.errors('Failed to validate contribution.');
		req.app.debug.object(error);
	}
};

// Call submitContribution when this route is requested.
router.post('/:campaign_id/', submitContribution);

module.exports = router;

