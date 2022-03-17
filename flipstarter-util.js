const libauth = require("@bitauth/libauth");

// Wrap the application in an async function to allow use of await/async.
const main = async function (transactionToSpendHex, privateKey) {
    const crypto = await libauth.instantiateBIP32Crypto()

    const publicKey = crypto.secp256k1.derivePublicKeyCompressed(privateKey);
    const addressHash = crypto.ripemd160.hash(crypto.sha256.hash(publicKey));

    const transactionToSpendBytes = libauth.hexToBin(transactionToSpendHex);
    const transactionToSpendHash = (function() {
        const hashReverseEndian = (crypto.sha256.hash(crypto.sha256.hash(transactionToSpendBytes)));
        hashReverseEndian.reverse();
        return hashReverseEndian;
    })();
    const transactionToSpend = libauth.decodeTransactionUnsafe(transactionToSpendBytes);

    const outputIndexToSpend = (function() {
        const expectedOutputLockingScript = ("76a914" + libauth.binToHex(addressHash) + "88ac");
        for (let outputIndex in transactionToSpend.outputs) {
            const transactionOutput = transactionToSpend.outputs[outputIndex];
            if (libauth.binToHex(transactionOutput.lockingBytecode) == expectedOutputLockingScript) {
                return outputIndex;
            }
        }
        return null;
    })();
    const outputToSpend = transactionToSpend.outputs[outputIndexToSpend];

    const sequenceNumber = 4294967295;
    const signingSerialization = libauth.generateSigningSerializationBCH({
        correspondingOutput: Uint8Array.of(),
        coveredBytecode: outputToSpend.lockingBytecode,
        locktime: 0,
        outpointIndex: outputIndexToSpend,
        outpointTransactionHash: transactionToSpendHash,
        outputValue: outputToSpend.satoshis,
        sequenceNumber: sequenceNumber,
        sha256: crypto.sha256,
        signingSerializationType: Uint8Array.of(libauth.SigningSerializationFlag.allOutputs | libauth.SigningSerializationFlag.forkId),
        transactionOutpoints: libauth.encodeOutpoints(transactionToSpend.inputs),
        transactionOutputs: libauth.encodeOutputsForSigning(transactionToSpend.outputs),
        transactionSequenceNumbers: libauth.encodeSequenceNumbersForSigning(transactionToSpend.inputs),
        version: 2
    });

    const signingSerializationHash = crypto.sha256.hash(crypto.sha256.hash(signingSerialization));
    
    // generate ecdsa signature
    const signatureFlags = Uint8Array.of(libauth.SigningSerializationFlag.singleInput | libauth.SigningSerializationFlag.allOutputs | libauth.SigningSerializationFlag.forkId);
    const rawSignature = crypto.secp256k1.signMessageHashDER(privateKey, signingSerializationHash);
    const libauthSig = libauth.flattenBinArray([rawSignature, signatureFlags]);

    // applying a signature to transaction
    const scriptSig = libauth.flattenBinArray([
        libauth.encodeDataPush(libauthSig),
        libauth.encodeDataPush(publicKey),
    ]);

    transactionToSpend.inputs[0].unlockingBytecode = scriptSig;

    const alias = "ALIAS";
    const comment = "COMMENT";

    const pledge = {
        "inputs": [{
            "previous_output_transaction_hash": libauth.binToHex(transactionToSpendHash),
            "previous_output_index": outputIndexToSpend,
            "sequence_number": sequenceNumber,
            "unlocking_script": libauth.binToHex(scriptSig),
        }],
        "data": {
            "alias": alias,
            "comment": comment,
        },
        "data_signature": null
    };

    return window.btoa(JSON.stringify(pledge));
};

window.main = main;
