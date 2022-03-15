(function() {
    window.webSocket = null;

    if (window.location.protocol == "http:") {
        webSocket = new WebSocket("ws://" + window.location.host + "/websocket");
    }
    else {
        webSocket = new WebSocket("wss://" + window.location.host + "/websocket");
    }

    webSocket.onopen = function() { };

    webSocket.onmessage = function(event) {
        const message = JSON.parse(event.data);
        console.log(message);

        if (message.ping) {
            const pongMessage = {
                "pong": message.ping
            };

            webSocket.send(JSON.stringify(pongMessage));
        }

        return false;
    };

    webSocket.onclose = function() {
        console.log("WebSocket closed...");
    };
})();
