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
            websocketConnection.on("message", function(messageString) {
                const message = JSON.parse(messageString);
                console.log(message);

                const addressString = message.address;
                if (addressString) {
                    console.log("addressString: " + addressString);

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

                    const addressDecodeResult = libauth.decodeCashAddress(addressString);
                    if (isValidResult(addressDecodeResult)) {
                        const nonPrefixAddressString = addressString.substring(addressString.indexOf(":"));
                        setAddressVersion(nonPrefixAddressString, addressDecodeResult);

                        const addressBytes = (addressDecodeResult.payload || addressDecodeResult.hash);

                        const lockingScript = assuranceContract.getLockscriptFromAddress(addressString);
                        console.log("lockingScript: " + lockingScript.toString("hex"));
                        const lockingScriptHash = libox.Crypto.sha256(lockingScript);
                        console.log("lockingScriptHash: " + lockingScriptHash.toString("hex"));

                        const callback = async function(data) {
                            console.log("callback: " + data);
                        };

                        const lockingScriptHashReverseHex = javascriptUtilities.reverseBuf(lockingScriptHash).toString("hex");
                        console.log("lockingScriptHashReverseHex: " + lockingScriptHashReverseHex);
                        app.electrum.subscribe(callback, "blockchain.scripthash.subscribe", lockingScriptHashReverseHex);
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
