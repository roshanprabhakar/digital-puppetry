//special designation: solely takes data, does not broadcast its own out

let SERVER_PORT = 3000;
let socketConnection;

let connections = {}; //collection of PeerConnection references, pc ID maps to pc
let dataChannels = {}; //collection of channel references, pc ID maps to channel reference
let buffers = {}; //maps ID to a buffer for that datastream

function start() {

    socketConnection = new WebSocket('ws://' + window.location.hostname + ':' + SERVER_PORT);

    socketConnection.onmessage = (e) => {

        let message = JSON.parse(e.data);
        console.log("received message: " + JSON.stringify(message));

        //only process client requests, id==1 belongs to the receiver node
        if (message.identifiedas === 1) {
            console.log("message ignored, intended for client 1"); //client 1 is designated receiving node
            return;
        }

        if (!(message.identifier in connections)) {

            console.log("new client node detected, creating local node");
            connections[message.identifier] = new RTCPeerConnection({});
            buffers[message.identifier] = [];

            let poseElement = document.createElement('canvas');
            poseElement.setAttribute('id', 'remotePose' + message.identifier);
            poseElement.setAttribute('class', 'poseCanvas');

            let poseContext = poseElement.getContext('2d');

            // poseContext.fillStyle = "red";
            // poseContext.fillRect(0, 0, poseElement.width, poseElement.height);

            document.getElementById('videos').appendChild(poseElement);

            //channel detected
            connections[message.identifier].ondatachannel = function(channelEvent) {
                console.log("detected remote datachannel, configuring...");
                channelEvent.channel.onopen = function() {
                    console.log("channel set to global scope");
                    dataChannels[message.identifier] = channelEvent.channel;
                };
                channelEvent.channel.onmessage = function(message) {

                    console.log("message received -==============================-");
                    poseContext.clearRect(0, 0, poseElement.width, poseElement.height); //clear canvas

                    let faceData = message.data;
                    if (faceData !== 0) {
                        let face = {
                            positions: reconstructFaceData(faceData),
                            faceInViewConfidence: 0.99
                        };
                        for (let i = 0; i < face.positions.length; i += 2) {
                            drawPoint(poseContext, face.positions[i + 1], face.positions[i], 2, 'red');
                        }
                    }
                    console.log("-==============================- message processed");
                }
            };

            //listen for incoming candidates
            connections[message.identifier].addEventListener('icecandidate', event => {
                console.log("detected candidate: " + event.candidate);
                let eventMessage = {
                    'identifier': message.identifier,
                    'icecandidate': event.candidate
                };
                console.log("candidate message: " + JSON.stringify(eventMessage));
                if (event.candidate === null) {
                    console.log("gathered null candidate, terminating");
                } else {
                    console.log("candidate is not null, transmitting...");
                    socketConnection.send(JSON.stringify(eventMessage));
                }
            });
        }

        if (message.sdpoffer) {
            console.log("sdp offer received: " + message.sdpoffer);

            connections[message.identifier].setRemoteDescription(message.sdpoffer).then(function() {
                console.log("successfully set remote description to offer");

                connections[message.identifier].createAnswer().then(async function(answer) {

                    console.log("answer created for received request, transmitting...");
                    socketConnection.send(JSON.stringify({
                        'identifier': message.identifier,
                        'sdpresponse': answer
                    }));
                    await connections[message.identifier].setLocalDescription(answer).then(() => {
                        console.log("local sdp description set for the corresponding client node");
                    });
                });
            });
        }

        if (message.icecandidate) {
            console.log("remote icecandidate received: " + message.icecandidate);

            connections[message.identifier].addIceCandidate(message.icecandidate).then(() => {
                console.log("successfully added candidate");
            }).catch((error => {
                console.log("could not add candidate, error: " + error);
            }));
        }
    };

    socketConnection.onopen = function(openEvent) {

    }
}

function reconstructFaceData(positionsBuffer) {
    let view = new Float32Array(positionsBuffer);
    let out = [];

    view.forEach(coordinate => {
        out.push(coordinate);
    });

    return out;
}

function drawPoint(ctx, y, x, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}
