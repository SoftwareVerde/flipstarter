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

    _getPublicKey() {
        const privateKey = this._privateKey;
        return this._crypto.secp256k1.derivePublicKeyCompressed(privateKey);
    }

    _getPublicKeyHash() {
        const publicKey = this._getPublicKey();
        return this._crypto.ripemd160.hash(
            this._crypto.sha256.hash(publicKey)
        );
    }

    _parseTransactionHex(transactionHex) {
        const wallet = this;

        const transactionBytes = libauth.hexToBin(transactionHex);
        const transactionHash = (function() {
            const hashReverseEndian = (wallet._crypto.sha256.hash(wallet._crypto.sha256.hash(transactionBytes)));
            hashReverseEndian.reverse();
            return hashReverseEndian;
        })();
        const transaction = libauth.decodeTransactionUnsafe(transactionBytes);
        
        const getOutputIndexToSpend = function(amount) {
            const publicKeyHash = wallet._getPublicKeyHash();

            const expectedOutputLockingScript = ("76a914" + libauth.binToHex(publicKeyHash) + "88ac");
            for (let outputIndex in transaction.outputs) {
                const transactionOutput = transaction.outputs[outputIndex];
                if (libauth.binToHex(transactionOutput.lockingBytecode) == expectedOutputLockingScript) {
                    if (amount) {
                        const outputAmount = libauth.binToBigIntUint64LE(transactionOutput.satoshis);
                        if (outputAmount == amount) {
                            return outputIndex;
                        }
                    }
                    else {
                        return outputIndex;
                    }
                }
            }
            return null;
        };

        return {
            hash: transactionHash,      // Uint8Array
            hex: transactionHex,        // String
            bytes: transactionBytes,    // Uint8Array
            getOutputIndex: getOutputIndexToSpend, // function(matchingOutputAmount)
            getOutput: function(outputIndex) {
                return transaction.outputs[outputIndex];
            }
        };
    }

    constructor(crypto) {
        this._crypto = crypto;

        this._privateKey = libauth.generatePrivateKey(function() {
            return window.crypto.getRandomValues(new Uint8Array(32));
        });
    }

    getAddress() {
        const publicKeyHash = this._getPublicKeyHash();
        return libauth.encodeCashAddress(libauth.CashAddressNetworkPrefix.mainnet, libauth.CashAddressVersionByte.P2PKH, publicKeyHash);
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

        const transactionToSpend = wallet._parseTransactionHex(transactionToSpendHex);
        const outputIndexToSpend = transactionToSpend.getOutputIndex(donationAmount);
        if (outputIndexToSpend == null) { return null; }

        const outputToSpend = transactionToSpend.getOutput(outputIndexToSpend);

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

        const sequenceNumber = 4294967295;
        const signature = (function() {
            const signatureFlagEnum = libauth.SigningSerializationFlag;
            const signatureFlags = Uint8Array.of(signatureFlagEnum.allOutputs | signatureFlagEnum.forkId);

            const signingSerialization = libauth.generateSigningSerializationBCH({
                correspondingOutput: Uint8Array.of(),
                coveredBytecode: outputToSpend.lockingBytecode,
                locktime: 0,
                outpointIndex: outputIndexToSpend,
                outpointTransactionHash: transactionToSpend.hash,
                outputValue: outputToSpend.satoshis,
                sequenceNumber: sequenceNumber,
                sha256: wallet._crypto.sha256,
                signingSerializationType: signatureFlags,
                transactionOutpoints: libauth.encodeOutpoints([{outpointIndex: outputIndexToSpend, outpointTransactionHash: transactionToSpend.hash}]),
                transactionOutputs: libauth.encodeOutputsForSigning(outputs),
                transactionSequenceNumbers: libauth.encodeSequenceNumbersForSigning([{sequenceNumber: sequenceNumber}]),
                version: 2
            });

            const signingSerializationHash = wallet._crypto.sha256.hash(wallet._crypto.sha256.hash(signingSerialization));
            const rawSignature = wallet._crypto.secp256k1.signMessageHashDER(wallet._privateKey, signingSerializationHash);

            return libauth.flattenBinArray([rawSignature, signatureFlags]);
        })();

        const publicKey = wallet._getPublicKey();
        const unlockingScript = libauth.flattenBinArray([
            libauth.encodeDataPush(signature),
            libauth.encodeDataPush(publicKey)
        ]);

        const transaction = {
            version: 2,
            inputs: [{
                outpointIndex: outputIndexToSpend,
                outpointTransactionHash: transactionToSpend.hash,
                sequenceNumber: sequenceNumber,
                unlockingBytecode: unlockingScript
            }],
            outputs: outputs,
            locktime: 0
        };

        const transactionBytes = libauth.encodeTransaction(transaction);
        return Wallet.toHexString(transactionBytes);
    }

    createPledge(transactionToSpendHex, contractRecipients, donationAmount, alias, comment) {
        const wallet = this;

        const transactionToSpend = wallet._parseTransactionHex(transactionToSpendHex);
        const outputIndexToSpend = transactionToSpend.getOutputIndex(donationAmount);
        if (outputIndexToSpend == null) { return null; }

        const outputToSpend = transactionToSpend.getOutput(outputIndexToSpend);

        const sequenceNumber = 4294967295;
        const signature = (function() {
            const contractOutputs = [];
            for (const outputIndex in contractRecipients) {
                const output = contractRecipients[outputIndex];
                const lockingScript = contract.getLockscriptFromAddress(output.user_address);
                const satoshis = contract.encodeOutputValue(output.recipient_satoshis);
                contractOutputs.push({
                    "satoshis": satoshis,
                    "lockingBytecode": lockingScript
                });
            }

            const signatureFlagEnum = libauth.SigningSerializationFlag;
            const signatureFlags = Uint8Array.of(signatureFlagEnum.singleInput | signatureFlagEnum.allOutputs | signatureFlagEnum.forkId);

            const signingSerialization = libauth.generateSigningSerializationBCH({
                correspondingOutput: Uint8Array.of(),
                coveredBytecode: outputToSpend.lockingBytecode,
                locktime: 0,
                outpointIndex: outputIndexToSpend,
                outpointTransactionHash: transactionToSpend.hash,
                outputValue: outputToSpend.satoshis,
                sequenceNumber: sequenceNumber,
                sha256: wallet._crypto.sha256,
                signingSerializationType: signatureFlags,
                transactionOutpoints: null,
                transactionOutputs: libauth.encodeOutputsForSigning(contractOutputs),
                transactionSequenceNumbers: null,
                version: 2
            });

            const signingSerializationHash = wallet._crypto.sha256.hash(wallet._crypto.sha256.hash(signingSerialization));
            const rawSignature = wallet._crypto.secp256k1.signMessageHashDER(wallet._privateKey, signingSerializationHash);

            return libauth.flattenBinArray([rawSignature, signatureFlags]);
        })();

        const publicKey = wallet._getPublicKey();
        const unlockingScript = libauth.flattenBinArray([
            libauth.encodeDataPush(signature),
            libauth.encodeDataPush(publicKey),
        ]);

        const pledge = {
            "inputs": [{
                "previous_output_transaction_hash": libauth.binToHex(transactionToSpend.hash),
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
