import * as posenet_module from '@tensorflow-models/posenet';
import * as facemesh_module from '@tensorflow-models/facemesh';
import * as tf from '@tensorflow/tfjs';
import * as paper from 'paper';
import dat from 'dat.gui';
import 'babel-polyfill';

import {drawKeypoints, drawPoint, drawSkeleton, isMobile, toggleLoadingUI, setStatusText} from '../utils/demoUtils';

import {SVGUtils} from '../utils/svgUtils';
import {PoseIllustration} from '../illustrationGen/illustration';
import {Skeleton, facePartName2Index} from '../illustrationGen/skeleton';
import {FileUtils} from '../utils/fileUtils';


import * as girlSVG from '../resources/illustration/girl.svg';
import * as boySVG from '../resources/illustration/boy.svg';
import * as abstractSVG from '../resources/illustration/abstract.svg';
import * as blathersSVG from '../resources/illustration/blathers.svg';
import * as tomNookSVG from '../resources/illustration/tom-nook.svg';

let facemesh;
let posenet;
let minPoseConfidence = 0.15;
let minPartConfidence = 0.1;
let nmsRadius = 30.0;

let mobile = false;
const avatarSvgs = {
    'girl': girlSVG.default,
    'boy': boySVG.default,
    'abstract': abstractSVG.default,
    'blathers': blathersSVG.default,
    'tom-nook': tomNookSVG.default,
};


let SERVER_PORT = 3000;
let identifier;

let socketConnection; //connection to signalling server
let pc; //local connection
let channel; //channel which streaming will occur through

const defaultPoseNetArchitecture = 'MobileNetV1';
const defaultQuantBytes = 2;
const defaultMultiplier = 1.0;
const defaultStride = 16;
const defaultInputResolution = 200;

async function initializeMlModels() {
    posenet = await posenet_module.load({
        architecture: defaultPoseNetArchitecture,
        outputStride: defaultStride,
        inputResolution: defaultInputResolution,
        multiplier: defaultMultiplier,
        quantBytes: defaultQuantBytes,
    });
    facemesh = await facemesh_module.load();
}

async function initiateVideoCollection() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
            'Browser API navigator.mediaDevices.getUserMedia not available');
    }
    const video = document.getElementById("source-video");
    const stream = await navigator.mediaDevices.getUserMedia({
        'audio': false,
        'video': {
            facingMode: 'user',
            width: 300,
            height: 250
        }
    });
    video.srcObject = stream;
    return new Promise(function(resolve) {
        video.onloadeddata = function() {
            resolve(video);
        }
    });
}

//clients send the first message, informing the receiver
function start() {

    socketConnection = new WebSocket('ws://' + window.location.hostname + ':' + SERVER_PORT);

    socketConnection.onmessage = async function (e) {

        console.log("message received");

        console.log("message event: " + e);
        let message = JSON.parse(e.data);

        console.log("parsed message: " + JSON.stringify(message));

        //message contains id information for this client
        if (message.identifiedas) {
            identifier = message.identifiedas;
            console.log("client assigned id: " + identifier);
        }

        //received ice candidate from receiver node
        if (message.icecandidate) {
            console.log("received candidate: " + message.icecandidate);
            pc.addIceCandidate(message.icecandidate).then(() => {
                console.log("successfully added candidate");
            }).catch((error => {
                console.log(error)
            }));
        }

        // message contains sdp information
        if (message.sdpresponse) {
            console.log("received sdp negotiation request");
            await pc.setRemoteDescription(message.sdpresponse).then(() => {
                console.log("successfully added sdp information");
            });
        }
    };

    //the client nodes will always initiate the handshake event
    socketConnection.onopen = function (openEvent) {

        //initialize local PeerConnection
        pc = new RTCPeerConnection();

        //initiate the data channel to this node
        console.log("creating data channel for this connection");
        channel = pc.createDataChannel('data-channel');
        console.log("heap reference: " + channel);
        channel.onopen = function(openEvent) {
            transmit();
        }

        //listen for incoming candidates
        pc.addEventListener('icecandidate', event => {
            console.log("ice candidate detected, transmitting...");
            let eventMessage = {
                'identifier': identifier,
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

        console.log("initiating sdp negotiation...");
        pc.createOffer({
            offerToReceiveVideo: 0,
            offerToReceiveAudio: 1
        }).then(function (offer) {
            console.log("offer generated: " + offer);
            pc.setLocalDescription(offer).then(function () {
                console.log("transmitting sdp offer...");
                let message = {
                    'identifier': identifier,
                    'sdpoffer': offer
                }
                socketConnection.send(JSON.stringify(message));
            });
        });
    }

}

/**
 * Loops the transmission of deconstructed poses
 *
 */
async function transmit() {

    // get face information
    const input = tf.browser.fromPixels(document.getElementById('source-video'));
    let faceDetection = await facemesh.estimateFaces(input, false, false);
    // console.log(JSON.stringify(faceDetection));
    input.dispose();

    // // initializes poses
    // let poses = [];
    //
    // // populates poses
    // let all_poses = await posenet.estimatePoses(video, {
    //     flipHorizontal: true,
    //     decodingMethod: 'multi-person',
    //     maxDetections: 1,
    //     scoreThreshold: minPartConfidence,
    //     nmsRadius: nmsRadius,
    // });
    //
    // // merges all poses
    // poses = poses.concat(all_poses);
    //
    // // clears previous render
    // videoCtx.clearRect(0, 0, videoWidth, videoHeight);
    //
    // // draw video
    // videoCtx.save();
    // videoCtx.scale(-1, 1);
    // videoCtx.translate(-videoWidth, 0);
    // videoCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
    // videoCtx.restore();
    //
    // // projects pose and face onto svg
    // keypointCtx.clearRect(0, 0, videoWidth, videoHeight);
    // if (guiState.debug.showDetectionDebug) {
    //     poses.forEach(({score, keypoints}) => {
    //         if (score >= minPoseConfidence) {
    //             drawKeypoints(keypoints, minPartConfidence, keypointCtx);
    //             drawSkeleton(keypoints, minPartConfidence, keypointCtx);
    //         }
    //     });
    //     faceDetection.forEach(face => {
    //         for (let i = 0; i < face.scaledMesh.length; i++) {
    //             let p = face.scaledMesh[i];
    //             drawPoint(keypointCtx, p[1], p[0], 2, 'red');
    //         }
    //         //
    //         // Object.values(facePartName2Index).forEach(index => {
    //         //     let p = face.scaledMesh[index];
    //         //     drawPoint(keypointCtx, p[1], p[0], 2, 'red');
    //         // });
    //     });
    // }
    //
    // // converts pose to streamable buffers
    // let deconstructedPose = deconstructPose(poses[0]);
    //
    // // deconstructedPose === null if difference between consecutive frames is 0
    // if (deconstructedPose !== null) {
    //     channel.send(deconstructedPose[0].buffer);
    //     channel.send(deconstructedPose[1].buffer);
    // }
    //
    // // channel.send(JSON.stringify(faceDetection));

    if (faceDetection && faceDetection.length > 0) {
        // let face = Skeleton.toFaceFrame(faceDetection[0]);
        let face = Skeleton.toBufferedFaceFrame(faceDetection[0]);
        channel.send(face.positions.buffer);
        // channel.send(face.faceInViewConfidence);
    } else {
        // channel.send(0);
        // channel.send(0);
    }

    await transmit();
}
//
// /**
//  * Converts a pose object to streamable array views, the corresponding
//  * buffers are streamed
//  *
//  */
// function deconstructPose(pose) {
//     if (pose == null) return null;
//
//     let confidences = new Int16Array(18);
//     let positions = new Int16Array(34);
//
//     confidences[0] = 10000 * pose.score; // to reduce transmission size
//     for (let i = 0; i < pose.keypoints.length; i++) {
//         confidences[i + 1] = 10000 * pose.keypoints[i].score;
//         positions[i * 2] = pose.keypoints[i].position.x;
//         positions[i * 2 + 1] = pose.keypoints[i].position.y;
//     }
//     return [confidences, positions];
// }

initializeMlModels().then(initiateVideoCollection).then(start);
