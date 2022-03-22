const WebSocket = require("ws");
const libauth = require("@bitauth/libauth");
const libox = require("../src/libox.js");
const assuranceContract = require("../src/assurance.js").Contract;
const javascriptUtilities = require("../src/util.js");

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
                    for (let i = 0; i < closedWebSocket.subscriptions.length; i += 1) {
                        const lockingScriptHashReverseHex = closedWebSocket.subscriptions[i];
                        const isWatchedDonationAddress = app.subscribedScriptHashes[lockingScriptHashReverseHex];
                        if (! isWatchedDonationAddress) { // Only subscribe from addresses that don't have a donation.
                            app.electrum.request("blockchain.scripthash.unsubscribe", lockingScriptHashReverseHex);
                        }
                    }
                });
                webSocketServer.purgeTimeout = null;
            }, maxTimeoutMs);
        }

        webSocketConnection.connectTimestamp = (new Date()).getTime();
        webSocketConnection.subscriptions = []; // Array of lockingScriptHashHex (reversed), representing subscribed electrum addresses.

        webSocketServer.connections.push(webSocketConnection);

        webSocketConnection.on("message", async function(messageString) {
            const message = JSON.parse(messageString);

            if (message.pong) {
                webSocketConnection.pongTimestamp = (new Date()).getTime();
            }

            const addressString = message.address;
            if (addressString) {
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

                    if (webSocketConnection.subscriptions.indexOf(lockingScriptHashReverseHex) >= 0) {
                        return; // Already subscribed...
                    }

                    const callback = async function(data) {
                        if (! Array.isArray(data)) { return; }
                        const scriptHash = data[0];
                        const scriptHashStatus = [1];
                        if (lockingScriptHashReverseHex != scriptHash) { return; }

                        const transactions = await app.electrum.request("blockchain.scripthash.get_history", scriptHash);
                        sendTransactionsToSocket(transactions);
                    };

                    app.electrumSubscribeCallbacks.push(callback);
                    app.electrum.subscribe(app.electrumSubscribeCallback, "blockchain.scripthash.subscribe", lockingScriptHashReverseHex);

                    const transactions = await app.electrum.request("blockchain.scripthash.get_history", lockingScriptHashReverseHex);
                    sendTransactionsToSocket(transactions);

                    webSocketConnection.subscriptions.push(lockingScriptHashReverseHex);
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
