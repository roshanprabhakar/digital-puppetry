# Digital Puppetry - Audience
This project intends to provide a tool to extract and measure audience feedback

### Usage

clone the repository:
```sh
git clone https://github.com/roshanprabhakar/digital-puppetry
```

Run the signalling server:
```sh
node app.js
```

Connect to this server as a receiver (this must happen before attempting to connect transmitter nodes):
* open a browser
* navigate to <hostname>:<port=3000>
* if the host is not on the same machine as the signalling server, hostname corresponds to the lan ip address of the signaling server

Connect to this server as a sender (only do this after a receiver has been established):
```sh
parcel sender/sender.html --no-hmr --open
```
* The first connection is designated the receiver (director) node, all data is streamed to this node
* All following connections stream facemesh information to the receiver node

### Note
* facemesh information is streamed
* posenet is not used for data extraction

* to connect to the receiver node from another machine on the lan, change the websocket connection window.location.hostname in sender.js to the lan ip address of the machine on which the receiever node is running.

### TODO
* facemesh is not accurately scaled, even though the extraction dimensions and projection dimensions are the same. the result is a downshift of all transmitted facemesh points, so that the mesh is not always in the receiving frame when there is a face in the transmitting frame.
