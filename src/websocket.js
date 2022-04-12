(function() {
    window.webSocket = null;

    const webSocket = {};

    webSocket._onConnectCallbacks = [];
    webSocket._onDisconnectCallbacks = [];
    webSocket._onMessageCallbacks = [];
    webSocket._reconnectTimeout = null;

    webSocket._connect = function() {
        if (window.location.protocol == "http:") {
            webSocket._core = new WebSocket("ws://" + window.location.host + "/websocket");
        }
        else {
            webSocket._core = new WebSocket("wss://" + window.location.host + "/websocket");
        }
    };

    webSocket._bind = function() {
        const webSocketCore = webSocket._core;
        if (! webSocketCore) { return; }

        webSocketCore.onopen = function() {
            window.clearInterval(webSocket._reconnectTimeout);

            for (let i in webSocket._onConnectCallbacks) {
                const callback = webSocket._onConnectCallbacks[i];
                if (callback) {
                    callback();
                }
            }
        };

        webSocketCore.onclose = function() {
            for (let i in webSocket._onDisconnectCallbacks) {
                const callback = webSocket._onDisconnectCallbacks[i];
                if (callback) {
                    callback();
                }
            }

            window.clearInterval(webSocket._reconnectTimeout);
            webSocket._reconnectTimeout = window.setInterval(function() {
                console.log("Reconnecting...");

                webSocket._connect();
                webSocket._bind();
            }, 1000);
        };

        webSocketCore.onmessage = function(event) {
            const message = JSON.parse(event.data);

            if (message.ping) {
                const pongMessage = {
                    "pong": message.ping
                };

                webSocketCore.send(JSON.stringify(pongMessage));
            }
            else {
                for (let i in webSocket._onMessageCallbacks) {
                    const callback = webSocket._onMessageCallbacks[i];
                    if (callback) {
                        callback(message);
                    }
                }
            }

            return false;
        };
    };

    webSocket.addMessageReceivedCallback = function(callback) {
        webSocket._onMessageCallbacks.push(callback);
    };

    webSocket.addConnectCallback = function(callback) {
        if (webSocket._core.readyState == WebSocket.OPEN) {
            webSocket._core.onopen = null;
            callback();
        }

        webSocket._onConnectCallbacks.push(callback);
    };

    webSocket.addDisconnectCallback = function(callback) {
        if (webSocket._core.readyState != WebSocket.OPEN) {
            webSocket._core.onclose = null;
            callback();
        }

        webSocket._onDisconnectCallbacks.push(callback);
    };

    webSocket.send = function(data) {
        if (! webSocket.isConnected()) { return; }
        webSocket._core.send(data);
    };

    webSocket.isConnected = function() {
        if (! webSocket._core) { return false; }
        return (webSocket._core.readyState == webSocket._core.OPEN);
    };

    webSocket._connect();
    webSocket._bind();

    window.webSocket = webSocket;
})();
