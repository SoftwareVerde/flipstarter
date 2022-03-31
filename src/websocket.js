(function() {
    window.webSocket = null;

    if (window.location.protocol == "http:") {
        webSocket = new WebSocket("ws://" + window.location.host + "/websocket");
    }
    else {
        webSocket = new WebSocket("wss://" + window.location.host + "/websocket");
    }

    webSocket._onConnectCallbacks = [];
    webSocket._onDisconnectCallbacks = [];
    webSocket._onMessageCallbacks = [];

    webSocket.onopen = function() {
        for (let i in webSocket._onConnectCallbacks) {
            const callback = webSocket._onConnectCallbacks[i];
            if (callback) {
                callback();
            }
        }
        webSocket._onConnectCallbacks = [];
    };

    webSocket.onclose = function() {
        for (let i in webSocket._onDisconnectCallbacks) {
            const callback = webSocket._onDisconnectCallbacks[i];
            if (callback) {
                callback();
            }
        }
        webSocket._onDisconnectCallbacks = [];
    };

    webSocket.onmessage = function(event) {
        const message = JSON.parse(event.data);

        if (message.ping) {
            const pongMessage = {
                "pong": message.ping
            };

            webSocket.send(JSON.stringify(pongMessage));
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

    webSocket.addMessageReceivedCallback = function(callback) {
        webSocket._onMessageCallbacks.push(callback);
    };

    webSocket.addConnectCallback = function(callback) {
        if (webSocket.readyState == WebSocket.OPEN) {
            webSocket.onopen = null;
            callback();
        }
        else {
            webSocket._onConnectCallbacks.push(callback);
        }
    };

    webSocket.addDisconnectCallback = function(callback) {
        if (webSocket.readyState != WebSocket.OPEN) {
            webSocket.onclose = null;
            callback();
        }
        else {
            webSocket._onDisconnectCallbacks.push(callback);
        }
    };
})();
