const WebSocket = require("ws");
const libauth = require("@bitauth/libauth");
const libox = require("../src/libox.js");
const assuranceContract = require("../src/assurance.js").Contract;
const javascriptUtilities = require("../src/util.js");

function createServer(app, webServer) {
    const websocketServer = new WebSocket.Server({
        noServer: true,
        path: "/websocket",
    });

    webServer.on("upgrade", function(request, socket, head) {
        websocketServer.handleUpgrade(request, socket, head, function(websocket) {
            websocketServer.emit("connection", websocket, request);
        });
    });

    websocketServer.on("connection",
        function connection(websocketConnection, connectionRequest) {
            websocketConnection.on("message", async function(messageString) {
                const message = JSON.parse(messageString);

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
                            websocketConnection.send(JSON.stringify({transaction: transactionData}));
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

                        const callback = async function(data) {
                            if (! Array.isArray(data)) { return; }
                            const scriptHash = data[0];
                            const scriptHashStatus = [1];
                            if (lockingScriptHashReverseHex != scriptHash) { return; }

                            const transactions = await app.electrum.request("blockchain.scripthash.get_history", scriptHash);
                            sendTransactionsToSocket(transactions);
                        };

                        app.electrum.subscribe(callback, "blockchain.scripthash.subscribe", lockingScriptHashReverseHex);

                        const transactions = await app.electrum.request("blockchain.scripthash.get_history", lockingScriptHashReverseHex);
                        sendTransactionsToSocket(transactions);
                    }
                }
            });

            websocketConnection.send(JSON.stringify({ping: 1}));
        }
    );

    return websocketServer;
};

module.exports = {
    createServer
};
