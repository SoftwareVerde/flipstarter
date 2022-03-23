const buffer = require("buffer/").Buffer;
const libauth = require("@bitauth/libauth");
const contract = require("./src/assurance").Contract;
const QrCode = require("./src/qrcode.js");

// Global exports...
window.Buffer = buffer;
window.libauth = libauth;

class Wallet {
    static async create() {
        const crypto = await libauth.instantiateBIP32Crypto();

        return new Wallet(crypto);
    }

    static fromHexString(hexString) {
        return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    }

    static toHexString(bytes) {
        return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
    }


    #_crypto = null;
    #_privateKey = null;

    constructor(crypto) {
        this._crypto = crypto;

        this._privateKey = libauth.generatePrivateKey(function() {
            return window.crypto.getRandomValues(new Uint8Array(32))
        });

        // TODO: Hardcoded private key for debugging... DO NOT USE
        // this._privateKey = Wallet.fromHexString("A7A117BE6E294242C997B34F0EC8F41EC9F104B445712B1AA41C0D38C204C879");
    }

    getAddress() {
        const publicKey = this._crypto.secp256k1.derivePublicKeyCompressed(this._privateKey);
        const hash = this._crypto.ripemd160.hash(this._crypto.sha256.hash(publicKey));
        return libauth.encodeCashAddress(libauth.CashAddressNetworkPrefix.mainnet, libauth.CashAddressVersionByte.P2PKH, hash);
    }

    createQrCode(widthPx, amount) {
        const width = widthPx || 82;
        const address = this.getAddress();

        const qr = QrCode(0, "M");
        qr.addData(address + "?amount=" + amount);
        qr.make();
        const html = qr.createImgTag();

        const divElement = document.createElement("div");
        divElement.innerHTML = html;
        const imgElement = divElement.firstElementChild;

        imgElement.setAttribute("width", width);
        imgElement.setAttribute("height", width);

        return imgElement;
    }

    createRefundTransaction(transactionToSpendHex, donationAmount, returnAddressString) {
        const wallet = this;
        const publicKey = wallet._crypto.secp256k1.derivePublicKeyCompressed(wallet._privateKey);
        const addressHash = wallet._crypto.ripemd160.hash(wallet._crypto.sha256.hash(publicKey));

        const transactionToSpendBytes = libauth.hexToBin(transactionToSpendHex);
        const transactionToSpendHash = (function() {
            const hashReverseEndian = (wallet._crypto.sha256.hash(wallet._crypto.sha256.hash(transactionToSpendBytes)));
            hashReverseEndian.reverse();
            return hashReverseEndian;
        })();
        const transactionToSpend = libauth.decodeTransactionUnsafe(transactionToSpendBytes);

        const outputIndexToSpend = (function() {
            const expectedOutputLockingScript = ("76a914" + libauth.binToHex(addressHash) + "88ac");
            for (let outputIndex in transactionToSpend.outputs) {
                const transactionOutput = transactionToSpend.outputs[outputIndex];
                if (libauth.binToHex(transactionOutput.lockingBytecode) == expectedOutputLockingScript) {
                    const outputAmount = libauth.binToBigIntUint64LE(transactionOutput.satoshis);
                    if (outputAmount == donationAmount) {
                        return outputIndex;
                    }
                }
            }
            return null;
        })();
        if (outputIndexToSpend == null) { return null; }

        const outputToSpend = transactionToSpend.outputs[outputIndexToSpend];
        const miningFee = BigInt(546);
        const refundAmount = libauth.binToBigIntUint64LE(outputToSpend.satoshis) - miningFee;
        const outputs = (function() {
            const lockingScript = contract.getLockscriptFromAddress(returnAddressString);
            const satoshis = contract.encodeOutputValue(Number(refundAmount));
            return [{
                "satoshis": satoshis,
                "lockingBytecode": lockingScript
            }];
        })();
        console.log(libauth.binToBigIntUint64LE(outputs[0].satoshis));

        const sequenceNumber = 4294967295;
        const signingSerialization = libauth.generateSigningSerializationBCH({
            correspondingOutput: Uint8Array.of(),
            coveredBytecode: outputToSpend.lockingBytecode,
            locktime: 0,
            outpointIndex: outputIndexToSpend,
            outpointTransactionHash: transactionToSpendHash,
            outputValue: outputToSpend.satoshis,
            sequenceNumber: sequenceNumber,
            sha256: wallet._crypto.sha256,
            signingSerializationType: Uint8Array.of(libauth.SigningSerializationFlag.allOutputs | libauth.SigningSerializationFlag.forkId),
            transactionOutpoints: libauth.encodeOutpoints([{outpointIndex: outputIndexToSpend, outpointTransactionHash: transactionToSpendHash}]),
            transactionOutputs: libauth.encodeOutputsForSigning(outputs),
            transactionSequenceNumbers: libauth.encodeSequenceNumbersForSigning([{sequenceNumber: sequenceNumber}]),
            version: 2
        });
console.log({
            correspondingOutput: Uint8Array.of(),
            coveredBytecode: outputToSpend.lockingBytecode,
            locktime: 0,
            outpointIndex: outputIndexToSpend,
            outpointTransactionHash: transactionToSpendHash,
            outputValue: outputToSpend.satoshis,
            sequenceNumber: sequenceNumber,
            sha256: wallet._crypto.sha256,
            signingSerializationType: Uint8Array.of(libauth.SigningSerializationFlag.allOutputs | libauth.SigningSerializationFlag.forkId),
            transactionOutpoints: libauth.encodeOutpoints([{outpointIndex: outputIndexToSpend, outpointTransactionHash: transactionToSpendHash}]),
            transactionOutputs: libauth.encodeOutputsForSigning(outputs),
            transactionSequenceNumbers: libauth.encodeSequenceNumbersForSigning([{sequenceNumber: sequenceNumber}]),
            version: 2
        });

        const signingSerializationHash = wallet._crypto.sha256.hash(wallet._crypto.sha256.hash(signingSerialization));

        // generate ecdsa signature
        const signatureFlags = Uint8Array.of(libauth.SigningSerializationFlag.allOutputs | libauth.SigningSerializationFlag.forkId);
        const rawSignature = wallet._crypto.secp256k1.signMessageHashDER(wallet._privateKey, signingSerializationHash);
        const libauthSig = libauth.flattenBinArray([rawSignature, signatureFlags]);

        // applying a signature to transaction
        const unlockingScript = libauth.flattenBinArray([
            libauth.encodeDataPush(libauthSig),
            libauth.encodeDataPush(publicKey)
        ]);

        const transaction = {
            version: 2,
            inputs: [{
                outpointIndex: outputIndexToSpend,
                outpointTransactionHash: transactionToSpendHash,
                sequenceNumber: sequenceNumber,
                unlockingBytecode: unlockingScript
            }],
            outputs: outputs,
            locktime: 0
        };

        (async function() {
            const program = {
                inputIndex: 0,
                sourceOutput: {
                    lockingBytecode: outputToSpend.lockingBytecode,
                    satoshis: libauth.bigIntToBinUint64LE(BigInt(donationAmount)),
                },
                spendingTransaction: transaction,
            };

            const vm = await libauth.instantiateVirtualMachineBCH();
            const programEval = vm.evaluate(program);
            console.log('program evaluation post sig:');
            console.log(JSON.stringify(programEval));
        })();

        const transactionBytes = libauth.encodeTransaction(transaction);
        return Wallet.toHexString(transactionBytes);
    }

    createPledge(transactionToSpendHex, contractRecipients, donationAmount, alias, comment) {
        const wallet = this;
        const serializeContractOutputs = function(recipientOutputs) {
            const outputs = [];
            for (const outputIndex in recipientOutputs) {
                const output = recipientOutputs[outputIndex];
                const lockingScript = contract.getLockscriptFromAddress(output.user_address);
                const satoshis = contract.encodeOutputValue(output.recipient_satoshis);
                outputs.push({
                    "satoshis": satoshis,
                    "lockingBytecode": lockingScript
                });
            }
            return outputs;
        };

        const publicKey = wallet._crypto.secp256k1.derivePublicKeyCompressed(wallet._privateKey);
        const addressHash = wallet._crypto.ripemd160.hash(wallet._crypto.sha256.hash(publicKey));

        const transactionToSpendBytes = libauth.hexToBin(transactionToSpendHex);
        const transactionToSpendHash = (function() {
            const hashReverseEndian = (wallet._crypto.sha256.hash(wallet._crypto.sha256.hash(transactionToSpendBytes)));
            hashReverseEndian.reverse();
            return hashReverseEndian;
        })();
        const transactionToSpend = libauth.decodeTransactionUnsafe(transactionToSpendBytes);

        const outputIndexToSpend = (function() {
            const expectedOutputLockingScript = ("76a914" + libauth.binToHex(addressHash) + "88ac");
            for (let outputIndex in transactionToSpend.outputs) {
                const transactionOutput = transactionToSpend.outputs[outputIndex];
                if (libauth.binToHex(transactionOutput.lockingBytecode) == expectedOutputLockingScript) {
                    const outputAmount = libauth.binToBigIntUint64LE(transactionOutput.satoshis);
                    if (outputAmount == donationAmount) {
                        return outputIndex;
                    }
                }
            }
            return null;
        })();
        if (outputIndexToSpend == null) { return null; }

        const outputToSpend = transactionToSpend.outputs[outputIndexToSpend];

        const contractOutputs = serializeContractOutputs(contractRecipients);
        console.log(libauth.binToBigIntUint64LE(contractOutputs[0].satoshis));

        const sequenceNumber = 4294967295;
        const signingSerialization = libauth.generateSigningSerializationBCH({
            correspondingOutput: Uint8Array.of(),
            coveredBytecode: outputToSpend.lockingBytecode,
            locktime: 0,
            outpointIndex: outputIndexToSpend,
            outpointTransactionHash: transactionToSpendHash,
            outputValue: outputToSpend.satoshis,
            sequenceNumber: sequenceNumber,
            sha256: wallet._crypto.sha256,
            signingSerializationType: Uint8Array.of(libauth.SigningSerializationFlag.singleInput | libauth.SigningSerializationFlag.allOutputs | libauth.SigningSerializationFlag.forkId),
            transactionOutpoints: null,
            transactionOutputs: libauth.encodeOutputsForSigning(contractOutputs),
            transactionSequenceNumbers: null,
            version: 2
        });
console.log({
            correspondingOutput: Uint8Array.of(),
            coveredBytecode: outputToSpend.lockingBytecode,
            locktime: 0,
            outpointIndex: outputIndexToSpend,
            outpointTransactionHash: transactionToSpendHash,
            outputValue: outputToSpend.satoshis,
            sequenceNumber: sequenceNumber,
            sha256: wallet._crypto.sha256,
            signingSerializationType: Uint8Array.of(libauth.SigningSerializationFlag.singleInput | libauth.SigningSerializationFlag.allOutputs | libauth.SigningSerializationFlag.forkId),
            transactionOutpoints: null,
            transactionOutputs: libauth.encodeOutputsForSigning(contractOutputs),
            transactionSequenceNumbers: null,
            version: 2
        });

        const signingSerializationHash = wallet._crypto.sha256.hash(wallet._crypto.sha256.hash(signingSerialization));

        // generate ecdsa signature
        const signatureFlags = Uint8Array.of(libauth.SigningSerializationFlag.singleInput | libauth.SigningSerializationFlag.allOutputs | libauth.SigningSerializationFlag.forkId);
        const rawSignature = wallet._crypto.secp256k1.signMessageHashDER(wallet._privateKey, signingSerializationHash);
        const libauthSig = libauth.flattenBinArray([rawSignature, signatureFlags]);

        // applying a signature to transaction
        const unlockingScript = libauth.flattenBinArray([
            libauth.encodeDataPush(libauthSig),
            libauth.encodeDataPush(publicKey),
        ]);

        const pledge = {
            "inputs": [{
                "previous_output_transaction_hash": libauth.binToHex(transactionToSpendHash),
                "previous_output_index": outputIndexToSpend,
                "sequence_number": sequenceNumber,
                "unlocking_script": libauth.binToHex(unlockingScript),
            }],
            "data": {
                "alias": alias,
                "comment": comment,
            },
            "data_signature": null
        };

        return window.btoa(JSON.stringify(pledge));
    };

    getPrivateKey() {
        return libauth.encodePrivateKeyWif(this._crypto.sha256, this._privateKey, "mainnet");
    }
}

window.Wallet = Wallet;
window.setTimeout(async function() {
    const wallet = await Wallet.create();
    window.Wallet.instance = wallet;
}, 0);
