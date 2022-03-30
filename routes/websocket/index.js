const WebSocket = require("ws");
const libauth = require("@bitauth/libauth");
const libox = require("../../src/libox.js");
const assuranceContract = require("../../src/assurance.js").Contract;
const javascriptUtilities = require("../../src/util.js");

function createServer(app, webServer) {
    const webSocketServer = new WebSocket.Server({
        noServer: true,
        path: "/websocket",
    });

    webSocketServer.connections = [];
    webSocketServer.pingConnections = function() {
        const timestamp = (new Date()).getTime();
        const pingMessage = JSON.stringify({ping: timestamp});

        for (let i = 0; i < webSocketServer.connections.length; i += 1) {
            const webSocketConnection = webSocketServer.connections[i];
            webSocketConnection.send(pingMessage);
        }
    };
    webSocketServer.purgeOldConnections = function(thresholdMs, onDisconnectCallback) {
        const timestamp = (new Date()).getTime();
        for (let i = 0; i < webSocketServer.connections.length; i += 1) {
            const webSocketConnection = webSocketServer.connections[i];
            if (webSocketConnection == null) { continue; }

            const pongTimestamp = webSocketConnection.pongTimestamp || webSocketConnection.connectTimestamp;

            const durationMs = (timestamp - pongTimestamp);
            if (durationMs > thresholdMs) {
                webSocketConnection.close(); // webSocketConnection.terminate();
                webSocketServer[i] = null;

                if (onDisconnectCallback) {
                    onDisconnectCallback(webSocketConnection);
                }
            }
        }
    };

    webServer.on("upgrade", function(request, socket, head) {
        webSocketServer.handleUpgrade(request, socket, head, function(webSocket) {
            webSocketServer.emit("connection", webSocket, request);
        });
    });

    webSocketServer.on("connection", function connection(webSocketConnection, connectionRequest) {
        // Ping connections and purge nonresponsive ones.
        // TODO: Should migrate to background thread instead of new-connection event.
        webSocketServer.pingConnections();
        if (! webSocketServer.purgeTimeout) {
            const maxTimeoutMs = 60000;
            webSocketServer.purgeTimeout = setTimeout(function() {
                webSocketServer.purgeOldConnections(maxTimeoutMs, function(closedWebSocket) {
                    for (let lockingScriptHashReverseHex in closedWebSocket.subscriptions) {
                        const isWatchedDonationAddress = app.subscribedScriptHashes[lockingScriptHashReverseHex];
                        if (! isWatchedDonationAddress) { // Only unsubscribe from addresses that don't have a donation.
                            app.electrum.request("blockchain.scripthash.unsubscribe", lockingScriptHashReverseHex);
                        }
                    }
                });
                webSocketServer.purgeTimeout = null;
            }, maxTimeoutMs);
        }

        webSocketConnection.connectTimestamp = (new Date()).getTime();
        webSocketConnection.subscriptions = {}; // Map of lockingScriptHashHex (reversed) to callbackId, representing subscribed electrum addresses.

        webSocketServer.connections.push(webSocketConnection);

        webSocketConnection.on("message", async function(messageString) {
            const message = JSON.parse(messageString);

            if (message.pong) {
                webSocketConnection.pongTimestamp = (new Date()).getTime();
            }

            if (message.refund) {
                const refundObject = message.refund;
                const token = refundObject.token;
                const transactionHex = refundObject.transaction;

                try {
                    const result = app.queries.setRefundTransaction.run({
                        token: token,
                        data: transactionHex
                    });
                }
                catch (exception) {
                    console.log(exception);
                }
            }

            const addressString = (message.addAddress || message.removeAddress);
            if (addressString) {
                const isUnsubscribe = (message.removeAddress ? true : false);
                const setAddressVersion = function(addressString, addressObject) {
                    if (addressString.startsWith("3") || addressString.startsWith("p")) {
                        addressObject.version = 1;
                    }
                    else if (addressString.startsWith("1") || addressString.startsWith("q")) {
                        addressObject.version = 0;
                    }
                };

                const isValidResult = function(result) {
                    return (result && typeof result != "string");
                };

                const sendTransactionsToSocket = async function(transactions) {
                    for (const transactionIndex in transactions) {
                        const transactionHash = transactions[transactionIndex].tx_hash;
                        const transaction = await app.electrum.request("blockchain.transaction.get", transactionHash, true);

                        const transactionData = transaction.hex;
                        webSocketConnection.send(JSON.stringify({transaction: transactionData}));
                    }
                };

                const addressDecodeResult = libauth.decodeCashAddress(addressString);
                if (isValidResult(addressDecodeResult)) {
                    const nonPrefixAddressString = addressString.substring(addressString.indexOf(":"));
                    setAddressVersion(nonPrefixAddressString, addressDecodeResult);

                    const addressBytes = (addressDecodeResult.payload || addressDecodeResult.hash);
                    const lockingScript = assuranceContract.getLockscriptFromAddress(addressString);
                    const lockingScriptHash = libox.Crypto.sha256(lockingScript);
                    const lockingScriptHashReverseHex = javascriptUtilities.reverseBuf(lockingScriptHash).toString("hex");

                    if (isUnsubscribe) {
                        const callbackId = webSocketConnection.subscriptions[lockingScriptHashReverseHex];
                        if (! callbackId) { return; }

                        delete webSocketConnection.subscriptions[lockingScriptHashReverseHex];
                        app.electrumSubscribeCallbacks[callbackId] = null;

                        const isWatchedDonationAddress = app.subscribedScriptHashes[lockingScriptHashReverseHex];
                        if (! isWatchedDonationAddress) { // Only unsubscribe from addresses that don't have a donation.
                            app.electrum.request("blockchain.scripthash.unsubscribe", lockingScriptHashReverseHex);
                        }
                    }
                    else {
                        if (! webSocketConnection.subscriptions[lockingScriptHashReverseHex]) { // Already subscribed...
                            const callback = async function(data) {
                                if (! Array.isArray(data)) { return; }
                                const scriptHash = data[0];
                                const scriptHashStatus = [1];
                                if (lockingScriptHashReverseHex != scriptHash) { return; }

                                const transactions = await app.electrum.request("blockchain.scripthash.get_history", scriptHash);
                                sendTransactionsToSocket(transactions);
                            };

                            const callbackId = app.electrumSubscribeCallbacks.push(callback) - 1;
                            webSocketConnection.subscriptions[lockingScriptHashReverseHex] = callbackId;

                            app.electrum.subscribe(app.electrumSubscribeCallback, "blockchain.scripthash.subscribe", lockingScriptHashReverseHex);
                        }

                        const transactions = await app.electrum.request("blockchain.scripthash.get_history", lockingScriptHashReverseHex);
                        sendTransactionsToSocket(transactions);
                    }
                }
            }
        });

        webSocketConnection.send(JSON.stringify({ping: 1}));
    });

    return webSocketServer;
};

module.exports = {
    createServer
};
