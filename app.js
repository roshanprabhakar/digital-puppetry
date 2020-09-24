// this is the central server for data distribution
// pose data is streamed here which is then stitched and distributed to all connected users


// design:
// central server, listening for a fixed number of actors
// the feed for each sender is not fed into a queue, packets may be lost but synchronization amongst actors is key

const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

let receiverSocket;
let clientSockets = {}; //maps identifier to websocket

let connectedClients = 0;

// connections to port 3000 will be served
let HTTP_PORT = 3000;

const handleHttpRequest = function (request, response) {

    console.log("received request: " + request.url);

    if (request.url === '/') {
        if (connectedClients === 0) {
            response.writeHead(200, {'Content-Type': 'text/html'});
            response.end(fs.readFileSync('receiver/index.html'));
        } else {
            response.writeHead(200, {'Content-Type': 'text/html'});
            response.end(fs.readFileSync('sender/sender.html'));
        }
    } else if (request.url === '/sender.js') {
        response.writeHead(200, {'Content-Type': 'application/javascript'});
        response.end(fs.readFileSync('sender/sender.js'));
    } else if (request.url === '/receiver.js') {
        response.writeHead(200, {'Content-Type': 'application/javascript'});
        response.end(fs.readFileSync('receiver/receiver.js'));
    }

}

const httpServer = http.createServer(handleHttpRequest);
httpServer.listen(HTTP_PORT);

const wss = new WebSocketServer({server: httpServer});

wss.on('connection', function (ws) {

    let connectionId = this.clients.size;
    console.log("received connection request, assigning id: " + connectionId);
    connectedClients++;

    //assign identifier, create peer connections
    ws.send(JSON.stringify({
        'identifiedas': connectionId
    }));

    if (connectionId === 1) {
        console.log("first client connected, assigning role: receiving node");

        //this client becomes the designated receiver
        receiverSocket = ws;

        //send the message to the appropriate client connection
        //message always contains identifier, sdp details
        ws.on('message', function(messageEvent) {

            console.log("message received from receiver node");
            console.log("forwarding to transmitting node...");

            let message = JSON.parse(messageEvent);
            clientSockets[message.identifier].send(messageEvent);
        });

    } else {

        //logs this socket as a client socket
        clientSockets[connectionId] = ws;

        // this message will only contain config info for the receiving socket, just pass it on to the receiver
        ws.on('message', function (messageEvent) {

            console.log("message received from transmitting node");
            console.log("forwarding to receiver...");

            receiverSocket.send(messageEvent);
        });
    }

    ws.on('error', () => ws.terminate());
});

